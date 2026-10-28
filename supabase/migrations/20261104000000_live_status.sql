-- Estado en vivo de los canales vigilados (tarea 26b, SPEC-live-status,
-- historia 2 y "Modelo de datos"). Lo escribe solo el refresco del cron (y en
-- la 26c "Comprobar ahora"), con la clave de servicio y por funciones
-- `ingest_*`: nadie falsifica un "En vivo". La lectura pública, con la regla
-- de los 25 minutos, llega con la página (26c).

create table public.channel_status (
  channel_id      uuid primary key references public.provider_channels (id) on delete cascade,
  is_live         boolean not null default false,
  live_title      text check (char_length(live_title) <= 200 and live_title !~ '[[:cntrl:]]'),
  live_started_at timestamptz,
  live_url        text check (live_url ~ '^https://www\.(twitch\.tv|youtube\.com)/'),
  -- Última revisión que salió bien: si pasa de 25 minutos, la página no
  -- muestra "En vivo" (datos viejos, SPEC-live-status historia 5).
  checked_at      timestamptz,
  changed_at      timestamptz
);

alter table public.channel_status enable row level security;
revoke all on public.channel_status from public, anon, authenticated;

-- Los canales que alguien vigila ("Transmito en este canal"), uno por
-- proveedor y handle aunque varios links los compartan. Solo links que la
-- página muestra (visibles, en sección visible, de cuentas activas). Kick
-- queda para la v2.
create function public.ingest_live_targets()
returns table (
  provider           text,
  handle             text,
  channel_id         text,
  channel_checked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct
    l.provider::text,
    l.provider_handle,
    c.external_id,
    c.resolved_at
  from public.links l
  join public.link_media_settings m on m.link_id = l.id and m.watch_live
  join public.profiles p on p.id = l.owner_id and not p.disabled
  left join public.provider_channels c on c.provider = l.provider and c.handle = l.provider_handle
  where l.provider in ('youtube', 'twitch')
    and l.provider_handle is not null
    and l.visible
    and (
      l.section_id is null
      or exists (select 1 from public.sections s where s.id = l.section_id and s.visible)
    )
  order by 1, 2;
$$;

-- Guarda el estado de un canal tras una revisión que salió bien. Devuelve los
-- handles de las páginas que lo vigilan si cambió algo visible (para purgar
-- la caché); si no cambió, una lista vacía.
create function public.ingest_live_status(
  p_provider text, p_handle text, p_is_live boolean,
  p_title text, p_started_at timestamptz, p_url text
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel uuid;
  v_before  public.channel_status;
  v_changed boolean;
begin
  insert into public.provider_channels (provider, handle)
  values (p_provider::public.link_provider, p_handle)
  on conflict (provider, handle) do nothing;
  select c.id into v_channel from public.provider_channels c
  where c.provider = p_provider::public.link_provider and c.handle = p_handle;

  select * into v_before from public.channel_status s where s.channel_id = v_channel;
  v_changed := v_before.channel_id is null
    or v_before.is_live is distinct from p_is_live
    or (p_is_live and (
      v_before.live_title is distinct from p_title or v_before.live_url is distinct from p_url
    ));

  insert into public.channel_status as s
    (channel_id, is_live, live_title, live_started_at, live_url, checked_at, changed_at)
  values (
    v_channel, p_is_live,
    case when p_is_live then left(p_title, 200) end,
    case when p_is_live then p_started_at end,
    case when p_is_live then p_url end,
    now(),
    now()
  )
  on conflict (channel_id) do update
    set is_live = excluded.is_live,
        live_title = excluded.live_title,
        live_started_at = excluded.live_started_at,
        live_url = excluded.live_url,
        checked_at = excluded.checked_at,
        changed_at = case when v_changed then excluded.changed_at else s.changed_at end;

  if not v_changed then
    return array[]::text[];
  end if;
  return coalesce((
    select array_agg(distinct pg.handle::text)
    from public.links l
    join public.link_media_settings m on m.link_id = l.id and m.watch_live
    join public.pages pg on pg.id = l.page_id
    where l.provider = p_provider::public.link_provider and l.provider_handle = p_handle
  ), array[]::text[]);
end;
$$;

revoke all on function public.ingest_live_targets() from public, anon, authenticated;
grant execute on function public.ingest_live_targets() to service_role;
revoke all on function public.ingest_live_status(text, text, boolean, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.ingest_live_status(text, text, boolean, text, timestamptz, text)
  to service_role;
