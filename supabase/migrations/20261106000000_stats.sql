-- Estadísticas sin cookies (tarea 27, SPEC-click-analytics). Solo contadores
-- diarios por página: ni eventos sueltos, ni IP, ni user agent, ni referer, ni
-- identificadores. Las escribe solo `ingest_event` (con la clave de servicio,
-- desde `POST /api/e`); las lee el dueño de cada página (RLS).
--
-- Desde SPEC-pages, una cuenta puede tener varias páginas: se cuenta por
-- página (`page_id`), no por perfil. El día es UTC.

create table public.stats_daily (
  page_id uuid not null references public.pages (id) on delete cascade,
  day     date not null,
  views   integer not null default 0 check (views >= 0),
  clicks  integer not null default 0 check (clicks >= 0),
  primary key (page_id, day)
);

create table public.link_stats_daily (
  link_id uuid not null references public.links (id) on delete cascade,
  day     date not null,
  clicks  integer not null default 0 check (clicks >= 0),
  primary key (link_id, day)
);

create table public.stats_breakdown_daily (
  page_id   uuid not null references public.pages (id) on delete cascade,
  day       date not null,
  dimension text not null check (dimension in ('country', 'source')),
  value     text not null check (char_length(value) between 1 and 16),
  views     integer not null default 0 check (views >= 0),
  clicks    integer not null default 0 check (clicks >= 0),
  primary key (page_id, day, dimension, value)
);

create index stats_breakdown_daily_page_dimension
  on public.stats_breakdown_daily (page_id, dimension, day);

alter table public.stats_daily enable row level security;
alter table public.link_stats_daily enable row level security;
alter table public.stats_breakdown_daily enable row level security;

-- ── Lectura: solo el dueño de la página. Escritura: nadie (solo ingest_event) ─
revoke all on public.stats_daily, public.link_stats_daily, public.stats_breakdown_daily
  from public, anon, authenticated;
grant select on public.stats_daily, public.link_stats_daily, public.stats_breakdown_daily
  to authenticated;

create policy "el dueño ve las estadísticas de sus páginas" on public.stats_daily
  for select to authenticated
  using (exists (
    select 1 from public.pages pg where pg.id = page_id and pg.owner_id = (select auth.uid())
  ));

create policy "el dueño ve los clics de sus links" on public.link_stats_daily
  for select to authenticated
  using (exists (
    select 1 from public.links l where l.id = link_id and l.owner_id = (select auth.uid())
  ));

create policy "el dueño ve países y orígenes de sus páginas" on public.stats_breakdown_daily
  for select to authenticated
  using (exists (
    select 1 from public.pages pg where pg.id = page_id and pg.owner_id = (select auth.uid())
  ));

-- ── Un evento: suma en los contadores del día ────────────────────────────────
-- `view` cuenta una visita a la página del handle; `click`, un toque en un
-- link. Solo páginas y links que la página pública muestra, de cuentas
-- activas. Lo que hace el propio dueño (`p_viewer`) no cuenta. Lo inválido o
-- inexistente se ignora en silencio: el endpoint responde 204 igual (no revela
-- qué existe).
create function public.ingest_event(
  p_type text, p_handle text, p_link uuid, p_source text, p_country text, p_viewer uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page  uuid;
  v_owner uuid;
  v_day   date := (now() at time zone 'UTC')::date;
  v_views integer := case when p_type = 'view' then 1 else 0 end;
  v_clicks integer := case when p_type = 'click' then 1 else 0 end;
  v_country text := case when p_country ~ '^[A-Z]{2}$' then p_country else 'XX' end;
begin
  if p_source is null or p_source not in (
    'instagram', 'tiktok', 'x', 'youtube', 'facebook', 'linkedin', 'whatsapp', 'direct', 'other'
  ) then
    return;
  end if;

  if p_type = 'view' then
    select pg.id, pg.owner_id into v_page, v_owner
    from public.pages pg
    join public.profiles pr on pr.id = pg.owner_id and not pr.disabled
    where pg.handle = lower(coalesce(p_handle, ''));
  elsif p_type = 'click' then
    select l.page_id, l.owner_id into v_page, v_owner
    from public.links l
    join public.profiles pr on pr.id = l.owner_id and not pr.disabled
    where l.id = p_link
      and l.visible
      and (
        l.section_id is null
        or exists (select 1 from public.sections s where s.id = l.section_id and s.visible)
      );
  else
    return;
  end if;

  if v_page is null or v_owner = p_viewer then
    return;
  end if;

  insert into public.stats_daily as d (page_id, day, views, clicks)
  values (v_page, v_day, v_views, v_clicks)
  on conflict (page_id, day) do update
    set views = d.views + excluded.views, clicks = d.clicks + excluded.clicks;

  if p_type = 'click' then
    insert into public.link_stats_daily as d (link_id, day, clicks)
    values (p_link, v_day, 1)
    on conflict (link_id, day) do update set clicks = d.clicks + 1;
  end if;

  insert into public.stats_breakdown_daily as d (page_id, day, dimension, value, views, clicks)
  values
    (v_page, v_day, 'country', v_country, v_views, v_clicks),
    (v_page, v_day, 'source', p_source, v_views, v_clicks)
  on conflict (page_id, day, dimension, value) do update
    set views = d.views + excluded.views, clicks = d.clicks + excluded.clicks;
end;
$$;

-- ── Retención: 400 días (la corre un cron mensual) ───────────────────────────
create function public.ingest_purge_stats()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.stats_daily where day < (now() at time zone 'UTC')::date - 400;
  delete from public.link_stats_daily where day < (now() at time zone 'UTC')::date - 400;
  delete from public.stats_breakdown_daily where day < (now() at time zone 'UTC')::date - 400;
$$;

revoke all on function public.ingest_event(text, text, uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.ingest_event(text, text, uuid, text, text, uuid) to service_role;
revoke all on function public.ingest_purge_stats() from public, anon, authenticated;
grant execute on function public.ingest_purge_stats() to service_role;
