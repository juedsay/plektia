-- Imagen de la vista previa de un artículo (tarea 37c-2, SPEC-link-form "7c"):
-- el bucket solo acepta WebP o JPEG chicos, cada cuenta sube solo a su carpeta y
-- desde el panel, y un link solo apunta a una imagen de su dueño.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

create function pg_temp.login(uid uuid, client_id text default null)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', 'authenticated', 'client_id', client_id))::text,
           true);
$$;

create function pg_temp.as_anon()
returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '', true);
$$;

create function pg_temp.link_of(p_title text)
returns uuid language sql as $$
  select id from public.links where title = p_title
$$;

select is(
  (select row(public, file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'link-previews'),
  row(true, 81920::bigint, array['image/webp', 'image/jpeg'])::text,
  'bucket: público, 80 KB y solo WebP o JPEG');
select ok(private.is_reserved_handle('link-previews'), 'link-previews es una ruta propia, no un handle');

-- ── Storage ─────────────────────────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('link-previews', '11111111-1111-4111-8111-111111111111/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.webp') $$,
  'una cuenta sube a su carpeta');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('link-previews', '22222222-2222-4222-8222-222222222222/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4f.webp') $$,
  '42501', null, 'nadie sube a la carpeta de otro');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('link-previews', '11111111-1111-4111-8111-111111111111/portada.svg') $$,
  '42501', null, 'solo nombres {uuid}.webp o .jpg');

select pg_temp.login('11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-00000000000e');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('link-previews', '11111111-1111-4111-8111-111111111111/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d50.webp') $$,
  '42501', null, 'un cliente MCP no sube imágenes');
reset role;

select pg_temp.as_anon();
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('link-previews', '11111111-1111-4111-8111-111111111111/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d51.webp') $$,
  '42501', null, 'anon no sube nada');
reset role;

-- ── El link apunta a una imagen de su dueño ─────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ update public.links
     set preview_image_path = '11111111-1111-4111-8111-111111111111/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.webp'
     where id = pg_temp.link_of('Cómo testeo RLS con pgTAP') $$,
  'el dueño pone una imagen de su carpeta');
select throws_ok(
  $$ update public.links
     set preview_image_path = '22222222-2222-4222-8222-222222222222/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.webp'
     where id = pg_temp.link_of('Cómo testeo RLS con pgTAP') $$,
  '23514', null, 'no apunta a la carpeta de otro');
select throws_ok(
  $$ update public.links set preview_image_path = 'https://evil.example/x.png'
     where id = pg_temp.link_of('Cómo testeo RLS con pgTAP') $$,
  '23514', null, 'ni a una URL de afuera');

select pg_temp.login('11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-00000000000e');
select is_empty(
  $$ update public.links set preview_image_path = null
     where id = pg_temp.link_of('Cómo testeo RLS con pgTAP') returning id $$,
  'un cliente MCP no la cambia');

select pg_temp.as_anon();
select is(
  (select l ->> 'previewImagePath'
   from public.public_page_v v, jsonb_array_elements(v.sections) s, jsonb_array_elements(s -> 'links') l
   where v.handle = 'juedsay' and l ->> 'title' = 'Cómo testeo RLS con pgTAP'),
  '11111111-1111-4111-8111-111111111111/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.webp',
  'la vista pública expone la ruta (se sirve desde /link-previews/)');

select * from finish();
rollback;
