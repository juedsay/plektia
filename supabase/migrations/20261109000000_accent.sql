-- Color de acento de la página (tarea 36a, SPEC-appearance "Entrega 6b").
--
-- Una paleta curada: cada acento tiene un tono para el modo oscuro y otro para
-- el claro, los dos con contraste AAA (los define tokens.css). La base guarda
-- solo el nombre: nunca un color libre. `hueso` es el aspecto de siempre, así
-- que las páginas existentes no cambian.

create type public.accent_color as enum (
  'hueso', 'coral', 'ambar', 'cielo', 'lavanda', 'rosa', 'turquesa', 'arena'
);

alter table public.pages
  add column accent public.accent_color not null default 'hueso';

-- Como el tema y el modo: lo cambia el dueño desde el panel (las políticas de
-- escritura de `pages` ya exigen dueño activo y sin `client_id`).
grant update (accent) on public.pages to authenticated;

-- La vista pública suma el acento (al final: `create or replace` solo agrega columnas).
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
  pg.show_handle,
  pg.color_mode,
  pg.accent
from public.pages pg
join public.profiles pr on pr.id = pg.owner_id
where not pr.disabled;

revoke all on public.public_page_v from anon, authenticated;
grant select on public.public_page_v to anon, authenticated;
