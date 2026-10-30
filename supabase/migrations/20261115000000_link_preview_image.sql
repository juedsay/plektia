-- Imagen de la vista previa de un artículo (tarea 37c-2, SPEC-link-form "7c").
-- El panel la recorta a 480 × 252 y la re-codifica en el navegador; la Action la
-- valida otra vez con sus bytes y la guarda en `link-previews/{owner_id}/{uuid}`.
-- La página pública la sirve desde el propio sitio (`/link-previews/...`), igual
-- que los avatares: nunca se enlaza la imagen original del artículo.

-- ── 0. `link-previews` pasa a ser una ruta propia: nadie puede usarla de handle ─
create or replace function private.is_reserved_handle(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(value) = any (array[
    '_astro', '.well-known', 'about', 'admin', 'api', 'app', 'assets', 'auth',
    'avatars', 'contact', 'contacto', 'favicon.ico', 'help', 'legal', 'link-previews', 'login',
    'logout', 'mcp', 'new', 'oauth', 'privacidad', 'privacy', 'robots.txt',
    'settings', 'signup', 'sitemap.xml', 'static', 'support', 'terms', 'thumbs'
  ]);
$$;

select private.assert_no_reserved_handles_in_use();

-- ── 1. Bucket: público para leer, WebP o JPEG de hasta 80 KB ──────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('link-previews', 'link-previews', true, 81920, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. Políticas: cada cuenta solo en su carpeta, y desde el panel ────────────
-- Sin `update`: una imagen nueva es un archivo nuevo (caché de un año).
create policy "vistas previas: cada cuenta lee su carpeta" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'link-previews' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "vistas previas: cada cuenta sube a su carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'link-previews'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
    and storage.filename(name) ~ '^[0-9a-f-]{36}\.(webp|jpg)$'
    and ((select auth.jwt()) ->> 'client_id') is null
  );

create policy "vistas previas: cada cuenta borra de su carpeta" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'link-previews'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and ((select auth.jwt()) ->> 'client_id') is null
  );

-- ── 3. El link apunta solo a una imagen de su dueño ──────────────────────────
alter table public.links add column preview_image_path text;

alter table public.links
  add constraint links_preview_image_path_own_folder
  check (
    preview_image_path is null
    or preview_image_path ~ ('^' || owner_id::text || '/[0-9a-f-]{36}\.(webp|jpg)$')
  );

grant update (preview_image_path) on public.links to authenticated;

-- Cada link de la vista pública suma su imagen (las columnas de la vista no cambian).
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

revoke all on public.public_page_v from anon, authenticated;
grant select on public.public_page_v to anon, authenticated;
