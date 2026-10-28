-- Avatares (tarea 22, SPEC-admin-panel "Avatar"). El panel sube un WebP de
-- 512 × 512 ya re-codificado en el navegador; la Action lo valida otra vez y lo
-- guarda en `avatars/{owner_id}/{uuid}.webp`. La página pública lo sirve desde
-- el propio sitio (`/avatars/...`), nunca desde el dominio de Supabase.

-- ── 0. `avatars` pasa a ser una ruta propia: nadie puede usarla de handle ────
-- La misma lista que `src/domain/handle.ts` (sin el handle oficial).
create or replace function private.is_reserved_handle(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(value) = any (array[
    '_astro', '.well-known', 'about', 'admin', 'api', 'app', 'assets', 'auth',
    'avatars', 'contact', 'contacto', 'favicon.ico', 'help', 'legal', 'login',
    'logout', 'mcp', 'new', 'oauth', 'privacidad', 'privacy', 'robots.txt',
    'settings', 'signup', 'sitemap.xml', 'static', 'support', 'terms'
  ]);
$$;

-- Si alguna página o invitación ya usara `avatars`, el deploy se frena acá.
select private.assert_no_reserved_handles_in_use();

-- ── 1. Bucket ────────────────────────────────────────────────────────────────
-- Público para leer (como la página). La base rechaza lo que no sea WebP o pase
-- de 200 KB aunque alguien saltee la app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 204800, array['image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. Políticas: cada cuenta solo en su carpeta ─────────────────────────────
-- Sin `update`: un avatar nuevo es un archivo nuevo (la ruta lleva un uuid), así
-- la caché de un año de `/avatars/...` nunca sirve una imagen vieja.
create policy "avatares: cada cuenta lee su carpeta" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatares: cada cuenta sube a su carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
    and storage.filename(name) ~ '^[0-9a-f-]{36}\.webp$'
  );

create policy "avatares: cada cuenta borra de su carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ── 3. La página apunta solo a un avatar de su dueño ─────────────────────────
alter table public.pages
  add constraint pages_avatar_path_own_folder
  check (
    avatar_path is null
    or avatar_path ~ ('^' || owner_id::text || '/[0-9a-f-]{36}\.webp$')
  );

grant update (avatar_path) on public.pages to authenticated;
