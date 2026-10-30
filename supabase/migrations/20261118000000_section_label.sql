-- Rótulo de sección (tarea 38d, SPEC-styles): los estilos que numeran las
-- secciones ("Lado A", "L1", "I") usan este texto en lugar del automático si el
-- dueño lo escribe. Una línea corta y segura; `null` es el automático.

alter table public.sections
  add column label text check (
    label is null or (char_length(btrim(label)) between 1 and 16 and label !~ '[[:cntrl:]]')
  );

-- Se cambia desde el panel como el título (la RLS de update ya mira al dueño).
grant update (label) on public.sections to authenticated;

-- Cada sección de la vista pública suma su rótulo (las columnas de la vista no cambian).
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
          'label', s.label,
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
                  'placement', l.placement,
                  'highlight', l.highlight,
                  'kind', l.kind,
                  'previewImagePath', l.preview_image_path
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
                  'placement', l.placement,
                  'highlight', l.highlight,
                  'kind', l.kind,
                  'previewImagePath', l.preview_image_path
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
