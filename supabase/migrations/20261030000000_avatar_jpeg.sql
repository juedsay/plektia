-- Avatar en JPEG además de WebP (tarea 22b). Safari no sabe generar WebP desde
-- un `<canvas>`: ahí el panel recorta y re-codifica a JPEG. La app valida los
-- dos por su estructura (sin EXIF ni bytes de más); acá la base acepta los dos
-- tipos y la extensión `.jpg`, con los mismos límites.

update storage.buckets
set allowed_mime_types = array['image/webp', 'image/jpeg']
where id = 'avatars';

drop policy "avatares: cada cuenta sube a su carpeta" on storage.objects;
create policy "avatares: cada cuenta sube a su carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
    and storage.filename(name) ~ '^[0-9a-f-]{36}\.(webp|jpg)$'
  );

-- La migración de páginas ya tenía un check sin nombre propio (solo `.webp`):
-- se borran todos los checks de `avatar_path` y queda uno solo, el de abajo.
do $$
declare
  old_check record;
begin
  for old_check in
    select conname from pg_constraint
    where conrelid = 'public.pages'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%avatar_path%'
  loop
    execute format('alter table public.pages drop constraint %I', old_check.conname);
  end loop;
end;
$$;
alter table public.pages
  add constraint pages_avatar_path_own_folder
  check (
    avatar_path is null
    or avatar_path ~ ('^' || owner_id::text || '/[0-9a-f-]{36}\.(webp|jpg)$')
  );
