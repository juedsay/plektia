-- Fila de íconos (tarea 36d, SPEC-appearance "Entrega 6b").
--
-- Cada link elige dónde se muestra: en la lista (`list`, el de siempre), solo
-- como ícono en la fila bajo la bio (`icon`) o en los dos lugares (`both`).
-- Lo elige el dueño link por link desde el panel, así muestra solo los íconos
-- que quiere.

create type public.link_placement as enum ('list', 'icon', 'both');

alter table public.links
  add column placement public.link_placement not null default 'list';

-- Como la visibilidad: lo cambia el dueño desde el panel (las políticas de
-- escritura de `links` ya exigen dueño activo y sin `client_id`).
grant update (placement) on public.links to authenticated;

-- Cada link de la vista pública suma su lugar (las columnas de la vista no cambian).
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
                  'live', public.link_live(l.id),
                  'placement', l.placement
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
                  'live', public.link_live(l.id),
                  'placement', l.placement
        )
        order by l.position
      )
      from public.links l
      where l.page_id = pg.id and l.section_id is null and l.visible
    ),
    '[]'::jsonb
  ) as unsectioned_links,
  pg.show_handle,
  pg.color_mode,
  pg.accent,
  pg.link_shape,
  pg.name_font
from public.pages pg
join public.profiles pr on pr.id = pg.owner_id
where not pr.disabled;

revoke all on public.public_page_v from anon, authenticated;
grant select on public.public_page_v to anon, authenticated;
