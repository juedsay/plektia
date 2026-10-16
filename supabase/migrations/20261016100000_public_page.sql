-- Página pública (SPEC-links, "Lectura pública"; tarea 13): el perfil con sus
-- secciones y links visibles, en orden, en una sola consulta por handle.
--
-- `security_invoker`: la consulta corre con la RLS de quien pregunta (anon en la
-- página pública). Además la vista filtra lo oculto por su cuenta, así el dueño
-- con sesión ve su página igual que un visitante. Solo expone lo que la página
-- muestra: nunca `owner_id`, versiones ni el email.

create view public.public_page_v
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
  ) as unsectioned_links
from public.profiles p
where not p.disabled;

revoke all on public.public_page_v from anon, authenticated;
grant select on public.public_page_v to anon, authenticated;
