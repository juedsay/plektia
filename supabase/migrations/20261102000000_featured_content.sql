-- Contenido destacado de YouTube (tarea 25b, SPEC-live-status, "Modelo de
-- datos"). Lo escribe solo el refresco del cron, con la clave de servicio y
-- a través de funciones `ingest_*` acotadas: ni `anon` ni `authenticated`
-- pueden escribir (nadie falsifica qué se destaca). La lectura pública llega
-- con la página (tarea 25c).

-- ── 1. Canales: un `@handle` resuelto a su ID, compartido entre links ────────
create table public.provider_channels (
  id           uuid primary key default gen_random_uuid(),
  provider     public.link_provider not null,
  handle       text not null check (char_length(handle) between 1 and 100),
  external_id  text check (external_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  resolved_at  timestamptz,
  last_error   text check (char_length(last_error) <= 200),
  unique (provider, handle)
);

-- ── 2. Lo que se destaca en cada link ───────────────────────────────────────
create table public.featured_content (
  link_id      uuid primary key references public.links (id) on delete cascade,
  video_id     text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  kind         text not null check (kind in ('video', 'short', 'stream')),
  title        text not null check (char_length(title) between 1 and 200 and title !~ '[[:cntrl:]]'),
  published_at timestamptz not null,
  duration_s   integer check (duration_s >= 0),
  fetched_at   timestamptz not null default now()
);

alter table public.provider_channels enable row level security;
alter table public.featured_content enable row level security;
revoke all on public.provider_channels, public.featured_content from public, anon, authenticated;

-- ── 3. Cuota diaria y locks del cron (privados) ─────────────────────────────
create table private.quota_usage (
  provider text not null,
  day      date not null,
  units    integer not null default 0 check (units >= 0),
  primary key (provider, day)
);

create table private.job_locks (
  job          text primary key,
  locked_until timestamptz not null
);

revoke all on private.quota_usage, private.job_locks from public, anon, authenticated;

-- ── 4. Funciones de ingesta (solo `service_role`) ───────────────────────────

-- Toma el lock de un trabajo si está libre o venció; `false` si otro lo tiene.
create function public.ingest_try_lock(p_job text, p_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taken boolean;
begin
  insert into private.job_locks (job, locked_until)
  values (p_job, now() + make_interval(secs => p_seconds))
  on conflict (job) do update
    set locked_until = excluded.locked_until
    where private.job_locks.locked_until < now()
  returning true into v_taken;
  return coalesce(v_taken, false);
end;
$$;

create function public.ingest_release_lock(p_job text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.job_locks where job = p_job;
$$;

-- Suma unidades al día si no pasa el límite; `false` si lo pasaría. El día de
-- YouTube empieza a la medianoche del Pacífico (cuando se renueva la cuota).
create function public.ingest_consume_quota(p_provider text, p_units integer, p_daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'America/Los_Angeles')::date;
  v_ok boolean;
begin
  if p_units <= 0 or p_units > p_daily_limit then
    return false;
  end if;
  insert into private.quota_usage as q (provider, day, units)
  values (p_provider, v_day, p_units)
  on conflict (provider, day) do update
    set units = q.units + excluded.units
    where q.units + excluded.units <= p_daily_limit
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

-- Los links de YouTube que destacan algo, con su canal (si ya se resolvió) y
-- lo último guardado. Solo links visibles (y en una sección visible) de
-- cuentas activas: no se gasta cuota en lo que nadie ve.
create function public.ingest_featured_targets()
returns table (
  link_id           uuid,
  handle            text,
  featured_mode     text,
  pinned_video_id   text,
  channel_id        text,
  channel_checked_at timestamptz,
  current_video_id  text,
  fetched_at        timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id,
    l.provider_handle,
    coalesce(m.featured_mode, 'latest_video'),
    m.pinned_video_id,
    c.external_id,
    c.resolved_at,
    f.video_id,
    f.fetched_at
  from public.links l
  join public.profiles p on p.id = l.owner_id and not p.disabled
  left join public.link_media_settings m on m.link_id = l.id
  left join public.provider_channels c on c.provider = 'youtube' and c.handle = l.provider_handle
  left join public.featured_content f on f.link_id = l.id
  where l.provider = 'youtube'
    and l.provider_handle is not null
    and l.visible
    and (
      l.section_id is null
      or exists (select 1 from public.sections s where s.id = l.section_id and s.visible)
    )
    and coalesce(m.featured_mode, 'latest_video') <> 'none'
  order by l.id;
$$;

-- Guarda el resultado de resolver un canal. Un canal inexistente se guarda
-- sin ID: se reintenta al día siguiente, no en cada corrida.
create function public.ingest_channel(
  p_provider text, p_handle text, p_external_id text, p_error text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.provider_channels (provider, handle, external_id, resolved_at, last_error)
  values (p_provider::public.link_provider, p_handle, p_external_id, now(), left(p_error, 200))
  on conflict (provider, handle) do update
    set external_id = excluded.external_id,
        resolved_at = excluded.resolved_at,
        last_error = excluded.last_error;
$$;

-- Guarda lo destacado de un link. Devuelve el handle de su página si cambió
-- algo visible (para purgar la caché); `null` si quedó igual.
create function public.ingest_featured(
  p_link_id uuid, p_video_id text, p_kind text, p_title text,
  p_published_at timestamptz, p_duration_s integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.featured_content;
  v_handle text;
begin
  select pg.handle::text into v_handle
  from public.links l join public.pages pg on pg.id = l.page_id
  where l.id = p_link_id;
  if v_handle is null then
    return null; -- el link se borró mientras tanto
  end if;

  select * into v_before from public.featured_content f where f.link_id = p_link_id;
  insert into public.featured_content
    (link_id, video_id, kind, title, published_at, duration_s, fetched_at)
  values (p_link_id, p_video_id, p_kind, p_title, p_published_at, p_duration_s, now())
  on conflict (link_id) do update
    set video_id = excluded.video_id, kind = excluded.kind, title = excluded.title,
        published_at = excluded.published_at, duration_s = excluded.duration_s,
        fetched_at = excluded.fetched_at;

  if v_before.link_id is not null
     and v_before.video_id = p_video_id and v_before.kind = p_kind and v_before.title = p_title then
    return null;
  end if;
  return v_handle;
end;
$$;

-- Ya no hay nada que destacar (el canal no tiene de ese tipo, o el video
-- fijado se borró). Devuelve el handle si había algo.
create function public.ingest_featured_clear(p_link_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.featured_content f where f.link_id = p_link_id returning f.link_id
  )
  select pg.handle::text
  from deleted d
  join public.links l on l.id = d.link_id
  join public.pages pg on pg.id = l.page_id;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.ingest_try_lock(text, integer)',
    'public.ingest_release_lock(text)',
    'public.ingest_consume_quota(text, integer, integer)',
    'public.ingest_featured_targets()',
    'public.ingest_channel(text, text, text, text)',
    'public.ingest_featured(uuid, text, text, text, timestamptz, integer)',
    'public.ingest_featured_clear(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
