-- Altas idempotentes: el panel puede elegir el id de lo que crea, y un segundo
-- alta con el mismo id choca con la clave primaria (la app devuelve el primero).
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

create function pg_temp.login(uid uuid)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- En el seed, la primera página de cada usuario tiene el id del usuario.
select pg_temp.login('22222222-2222-4222-8222-222222222222');

select lives_ok(
  $$ insert into public.sections (id, page_id, title)
     values ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Una vez') $$,
  'una sección se crea con el id que elige el panel');
select throws_ok(
  $$ insert into public.sections (id, page_id, title)
     values ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Una vez') $$,
  '23505', null, 'el mismo alta de sección otra vez no la duplica');

select lives_ok(
  $$ insert into public.links (id, page_id, title, url)
     values ('aaaaaaaa-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
             'Una vez', 'https://plektia.app') $$,
  'un link se crea con el id que elige el panel');
select throws_ok(
  $$ insert into public.links (id, page_id, title, url)
     values ('aaaaaaaa-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
             'Una vez', 'https://plektia.app') $$,
  '23505', null, 'el mismo alta de link otra vez no lo duplica');

select lives_ok(
  $$ insert into public.pages (id, handle, display_name)
     values ('aaaaaaaa-0000-4000-8000-000000000003', 'una-vez', 'Una vez') $$,
  'una página se crea con el id que elige el panel');
select throws_ok(
  $$ insert into public.pages (id, handle, display_name)
     values ('aaaaaaaa-0000-4000-8000-000000000003', 'una-vez', 'Una vez') $$,
  '23505', null, 'el mismo alta de página otra vez no la duplica');
select is(
  (select count(*)::int from public.pages where handle = 'una-vez'), 1,
  'quedó una sola página');

-- El id no habilita nada más: la página sigue siendo de quien la crea.
select is(
  (select owner_id from public.pages where id = 'aaaaaaaa-0000-4000-8000-000000000003'),
  '22222222-2222-4222-8222-222222222222'::uuid,
  'la página creada con id elegido es de quien la crea');

select * from finish();
rollback;
