-- Avatares: el bucket solo acepta WebP chicos, cada cuenta escribe y borra solo
-- en su carpeta, y una página solo apunta a un avatar de su dueño.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

create function pg_temp.login(uid uuid)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.as_anon()
returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '', true);
$$;

-- Dueño 1111…, miembro 2222… (seed).
select is(
  (select row(public, file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'avatars'),
  row(true, 204800::bigint, array['image/webp'])::text,
  'bucket: público, 200 KB y solo WebP');

-- ── Storage ─────────────────────────────────────────────────────────────────
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '22222222-2222-4222-8222-222222222222/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.webp') $$,
  'una cuenta sube a su carpeta');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '11111111-1111-4111-8111-111111111111/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4f.webp') $$,
  '42501', null, 'nadie sube a la carpeta de otro');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '22222222-2222-4222-8222-222222222222/avatar.svg') $$,
  '42501', null, 'solo nombres {uuid}.webp');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '22222222-2222-4222-8222-222222222222/sub/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.webp') $$,
  '42501', null, 'sin subcarpetas');
reset role;

-- Que nadie borre el avatar de otro lo prueba la integración: Storage no deja
-- borrar filas por SQL, solo por su API.
select pg_temp.as_anon();
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '22222222-2222-4222-8222-222222222222/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d40.webp') $$,
  '42501', null, 'anon no sube nada');
reset role;

-- ── La página apunta a un avatar de su dueño ────────────────────────────────
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select lives_ok(
  $$ update public.pages
     set avatar_path = '22222222-2222-4222-8222-222222222222/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.webp'
     where id = '22222222-2222-4222-8222-222222222222' $$,
  'el dueño pone un avatar de su carpeta');
select throws_ok(
  $$ update public.pages
     set avatar_path = '11111111-1111-4111-8111-111111111111/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4f.webp'
     where id = '22222222-2222-4222-8222-222222222222' $$,
  '23514', null, 'una página no puede usar el avatar de otra cuenta');
select throws_ok(
  $$ update public.pages set avatar_path = 'https://evil.test/x.webp'
     where id = '22222222-2222-4222-8222-222222222222' $$,
  '23514', null, 'el avatar es una ruta del bucket, no una URL');
reset role;

select is(
  (select avatar_path from public.public_page_v where handle = 'miembro-demo'),
  '22222222-2222-4222-8222-222222222222/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.webp',
  'la página pública expone la ruta del avatar');

select * from finish();
rollback;
