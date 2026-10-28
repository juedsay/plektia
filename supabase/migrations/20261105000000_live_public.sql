-- "En vivo" en la página pública (tarea 26c, SPEC-live-status, historias 2 y
-- 5). La vista suma `live` a cada link: solo si el dueño marcó "Transmito en
-- este canal", el canal está en vivo y la última revisión que salió bien es de
-- los últimos 25 minutos. Así la regla de los datos viejos vive en la base: si
-- el cron falla, el aviso se apaga solo.

create function public.link_live(p_link_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', s.live_title,
    'startedAt', s.live_started_at,
    'url', s.live_url
  )
  from public.links l
  join public.link_media_settings m on m.link_id = l.id and m.watch_live
  join public.profiles p on p.id = l.owner_id and not p.disabled
  join public.provider_channels c on c.provider = l.provider and c.handle = l.provider_handle
  join public.channel_status s on s.channel_id = c.id
  where l.id = p_link_id
    and l.visible
    and l.provider in ('youtube', 'twitch')
    and (
      l.section_id is null
      or exists (select 1 from public.sections x where x.id = l.section_id and x.visible)
    )
    and s.is_live
    and s.checked_at > now() - interval '25 minutes';
$$;

revoke all on function public.link_live(uuid) from public;
grant execute on function public.link_live(uuid) to anon, authenticated;

-- Mismas columnas: solo cambia el JSON de cada link.
create or replace view public.public_page_v
with (security_invoker = true)
as
select
  pg.handle,
  pg.display_name,
  pg.bio,
  pg.avatar_path,
  pg.theme,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'showTitle', s.show_title,
          'links', coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', l.id,
                  'title', l.title,
                  'url', l.url,
                  'description', l.description,
                  'provider', l.provider,
                  'providerHandle', l.provider_handle,
                  'featured', public.link_featured(l.id),
                  'live', public.link_live(l.id)
                )
                order by l.position
              )
              from public.links l
              where l.section_id = s.id and l.visible
            ),
            '[]'::jsonb
          )
        )
        order by s.position
      )
      from public.sections s
      where s.page_id = pg.id and s.visible
    ),
    '[]'::jsonb
  ) as sections,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'url', l.url,
          'description', l.description,
          'provider', l.provider,
          'providerHandle', l.provider_handle,
          'featured', public.link_featured(l.id),
                  'live', public.link_live(l.id)
        )
        order by l.position
      )
      from public.links l
      where l.page_id = pg.id and l.section_id is null and l.visible
    ),
    '[]'::jsonb
  ) as unsectioned_links,
  pg.show_handle
from public.pages pg
join public.profiles pr on pr.id = pg.owner_id
where not pr.disabled;

revoke all on public.public_page_v from anon, authenticated;
grant select on public.public_page_v to anon, authenticated;

-- "Comprobar ahora" (historia 3): los canales vigilados de un solo dueño. La
-- Action valida antes la sesión y el límite de una vez por minuto; el Worker
-- llama a esta función con la clave de servicio y el dueño de la sesión.
create function public.ingest_live_targets_of(p_owner uuid)
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
  where l.owner_id = p_owner
    and l.provider in ('youtube', 'twitch')
    and l.provider_handle is not null
    and l.visible
    and (
      l.section_id is null
      or exists (select 1 from public.sections s where s.id = l.section_id and s.visible)
    )
  order by 1, 2;
$$;

revoke all on function public.ingest_live_targets_of(uuid) from public, anon, authenticated;
grant execute on function public.ingest_live_targets_of(uuid) to service_role;
