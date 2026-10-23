-- Página pública: la vista devuelve solo lo visible, en orden, en una consulta.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

create function pg_temp.login(uid uuid)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.as_anon()
returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '', true);
$$;

-- Datos de prueba propios (no dependen del seed): el owner 1111… arma su página.
delete from public.links where owner_id = '11111111-1111-4111-8111-111111111111';
delete from public.sections where owner_id = '11111111-1111-4111-8111-111111111111';
update public.pages set bio = null, show_handle = true;
insert into public.sections (id, owner_id, page_id, title, show_title, visible) values
  ('cccccccc-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Redes', true, true),
  ('cccccccc-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Oculta', true, false),
  ('cccccccc-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Proyectos', false, true);
insert into public.links (owner_id, page_id, section_id, title, url, visible) values
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'cccccccc-0000-4000-8000-000000000001', 'Twitch', 'https://twitch.tv/juedsay', true),
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'cccccccc-0000-4000-8000-000000000001', 'Borrador', 'https://plektia.app/b', false),
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'cccccccc-0000-4000-8000-000000000001', 'YouTube', 'https://youtube.com/@juedsay', true),
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'cccccccc-0000-4000-8000-000000000002', 'En oculta', 'https://plektia.app/o', true),
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'cccccccc-0000-4000-8000-000000000003', 'Plektia', 'https://plektia.app', true),
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', null, 'Mail', 'mailto:hola@plektia.app', true);
update public.links set provider = 'twitch', provider_handle = 'juedsay' where title = 'Twitch';

-- Segunda página del mismo dueño, con su propio link (SPEC-pages).
insert into public.pages (id, owner_id, handle, display_name) values
  ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'juedsay-pro', 'Juedsay Pro');
insert into public.links (owner_id, page_id, title, url) values
  ('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', 'Portfolio', 'https://jsimon.vercel.app/');

select pg_temp.as_anon();

select is((select count(*)::int from public.public_page_v where handle = 'juedsay'), 1,
  'anon: hay una fila por página');
select is((select count(*)::int from public.public_page_v where handle = 'JuedSay'), 1,
  'el handle se busca sin importar mayúsculas');
select results_eq(
  $$ select s ->> 'title' from public.public_page_v, jsonb_array_elements(sections) s where handle = 'juedsay' $$,
  $$ values ('Redes'), ('Proyectos') $$,
  'solo las secciones visibles, en orden');
select results_eq(
  $$ select l ->> 'title' from public.public_page_v, jsonb_array_elements(sections) s, jsonb_array_elements(s -> 'links') l
     where handle = 'juedsay' and s ->> 'title' = 'Redes' $$,
  $$ values ('Twitch'), ('YouTube') $$,
  'en cada sección, solo los links visibles y en orden');
select is(
  (select count(*)::int from public.public_page_v, jsonb_array_elements(sections) s, jsonb_array_elements(s -> 'links') l
   where handle = 'juedsay' and l ->> 'title' = 'En oculta'), 0,
  'un link visible dentro de una sección oculta no aparece');
select is(
  (select s -> 'showTitle' from public.public_page_v, jsonb_array_elements(sections) s
   where handle = 'juedsay' and s ->> 'title' = 'Proyectos'), 'false'::jsonb,
  'la vista informa si el título de la sección se muestra');
select is(
  (select unsectioned_links -> 0 ->> 'title' from public.public_page_v where handle = 'juedsay'), 'Mail',
  'los links "Sin sección" vienen aparte');
select is(
  (select l from public.public_page_v, jsonb_array_elements(sections) s, jsonb_array_elements(s -> 'links') l
   where handle = 'juedsay' and l ->> 'title' = 'Twitch') - 'id',
  '{"title": "Twitch", "url": "https://twitch.tv/juedsay", "description": null, "provider": "twitch", "providerHandle": "juedsay"}'::jsonb,
  'cada link expone solo lo que muestra la página (sin dueño ni versión)');
select hasnt_column('public', 'public_page_v', 'owner_id', 'la vista no expone el dueño');
select results_eq(
  $$ select l ->> 'title' from public.public_page_v, jsonb_array_elements(unsectioned_links) l where handle = 'juedsay-pro' $$,
  $$ values ('Portfolio') $$,
  'una segunda página muestra solo sus links');
select is(
  (select count(*)::int from public.public_page_v, jsonb_array_elements(unsectioned_links) l
   where handle = 'juedsay' and l ->> 'title' = 'Portfolio'), 0,
  'los links de una página no aparecen en otra del mismo dueño');
select is((select show_handle from public.public_page_v where handle = 'juedsay'), true,
  'el @handle se muestra por defecto');
reset role;

-- El dueño con sesión ve su página igual que un visitante.
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select results_eq(
  $$ select s ->> 'title' from public.public_page_v, jsonb_array_elements(sections) s where handle = 'juedsay' $$,
  $$ values ('Redes'), ('Proyectos') $$,
  'el dueño con sesión no ve lo oculto en su página pública');
update public.pages set show_handle = false where id = '11111111-1111-4111-8111-111111111111';
select is((select show_handle from public.public_page_v where handle = 'juedsay'), false,
  'el dueño puede ocultar su @handle');
reset role;

-- Nadie puede ocultar el @handle de otro.
select pg_temp.login('22222222-2222-4222-8222-222222222222');
update public.pages set show_handle = true where id = '11111111-1111-4111-8111-111111111111';
reset role;
select is((select show_handle from public.pages where id = '11111111-1111-4111-8111-111111111111'), false,
  'un miembro no cambia el show_handle de otro');

-- Un perfil dado de baja deja de tener página.
update public.profiles set disabled = true where id = '11111111-1111-4111-8111-111111111111';
select pg_temp.as_anon();
select is((select count(*)::int from public.public_page_v where handle = 'juedsay'), 0,
  'un perfil dado de baja no tiene página pública');
reset role;

select ok(
  has_table_privilege('anon', 'public.public_page_v', 'select')
    and not has_table_privilege('anon', 'public.public_page_v', 'insert,update,delete'),
  'anon solo puede leer la vista');

select * from finish();
rollback;
