-- En vivo repartido a lo largo del día (revisión de la ingesta). Cada canal
-- vigilado de YouTube cuesta unas 147 unidades por día (una revisión cada 10
-- minutos): con muchos canales, el fondo del en vivo se agotaba a la tarde y
-- "En vivo" dejaba de andar justo cuando más se transmite. Ahora cada corrida
-- revisa como mucho lo que le toca y empieza por los canales revisados hace más
-- tiempo (src/composition/live.ts): con muchos canales, cada uno se revisa
-- menos seguido, pero nunca se corta.

-- Los canales vigilados, del revisado hace más tiempo al más reciente (los que
-- nunca se revisaron, primero). Lo demás no cambia.
drop function public.ingest_live_targets();

create function public.ingest_live_targets()
returns table (
  provider           text,
  handle             text,
  channel_id         text,
  channel_checked_at timestamptz,
  live_checked_at    timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select provider, handle, channel_id, channel_checked_at, live_checked_at
  from (
    select distinct
      l.provider::text as provider,
      l.provider_handle as handle,
      c.external_id as channel_id,
      c.resolved_at as channel_checked_at,
      s.checked_at as live_checked_at
    from public.links l
    join public.link_media_settings m on m.link_id = l.id and m.watch_live
    join public.profiles p on p.id = l.owner_id and not p.disabled
    left join public.provider_channels c on c.provider = l.provider and c.handle = l.provider_handle
    left join public.channel_status s on s.channel_id = c.id
    where l.provider in ('youtube', 'twitch')
      and l.provider_handle is not null
      and l.visible
      and (
        l.section_id is null
        or exists (select 1 from public.sections x where x.id = l.section_id and x.visible)
      )
  ) watched
  order by live_checked_at nulls first, provider, handle;
$$;

revoke all on function public.ingest_live_targets() from public, anon, authenticated;
grant execute on function public.ingest_live_targets() to service_role;

-- Cuánto queda hoy en el más agotado de los fondos (lo que de verdad se puede
-- gastar). No reserva nada: es para planificar la corrida.
create function public.ingest_quota_remaining(p_buckets text[], p_limits integer[])
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(min(greatest(t.daily_limit - coalesce(q.units, 0), 0)), 0)::integer
  from unnest(p_buckets, p_limits) as t(bucket, daily_limit)
  left join private.quota_usage q
    on q.provider = t.bucket and q.day = (now() at time zone 'America/Los_Angeles')::date;
$$;

revoke all on function public.ingest_quota_remaining(text[], integer[]) from public, anon, authenticated;
grant execute on function public.ingest_quota_remaining(text[], integer[]) to service_role;
