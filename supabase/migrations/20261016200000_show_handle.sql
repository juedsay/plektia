-- `@handle` opcional en el encabezado (SPEC-public-page, "Diseño de la página").
-- Ocultarlo es solo de presentación: el handle sigue en la URL.

alter table public.profiles add column show_handle boolean not null default true;

-- El dueño lo cambia desde `/admin/perfil`, igual que el nombre y la bio.
grant update (show_handle) on public.profiles to authenticated;

create or replace view public.public_page_v
with (security_invoker = true)
as
select
  p.handle,
  p.display_name,
  p.bio,
  p.avatar_path,
  p.theme,
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
                  'providerHandle', l.provider_handle
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
      where s.owner_id = p.id and s.visible
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
          'providerHandle', l.provider_handle
        )
        order by l.position
      )
      from public.links l
      where l.owner_id = p.id and l.section_id is null and l.visible
    ),
    '[]'::jsonb
  ) as unsectioned_links,
  -- Al final: `create or replace view` solo permite agregar columnas al final.
  p.show_handle
from public.profiles p
where not p.disabled;
