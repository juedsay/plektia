-- Fila de íconos: dónde se muestra cada link (tarea 36d, SPEC-appearance "Entrega 6b").
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

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
  (select count(*)::int from public.links where placement <> 'list'), 0,
  'los links existentes quedaron en la lista');

select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ update public.links set placement = 'icon' where id = pg_temp.link_of('Instagram') $$,
  'el dueño pasa un link a la fila de íconos');
select lives_ok(
  $$ update public.links set placement = 'both' where id = pg_temp.link_of('GitHub') $$,
  'y otro a los dos lugares');
select throws_ok(
  $$ update public.links set placement = 'sidebar' where id = pg_temp.link_of('Twitch') $$,
  '22P02', null, 'un lugar que no existe se rechaza');
select is_empty(
  $$ update public.links set placement = 'icon' where id = pg_temp.link_of('Link de prueba número 1') returning id $$,
  'no cambia el lugar de un link ajeno');

select pg_temp.login('11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-00000000000e');
select is_empty(
  $$ update public.links set placement = 'icon' where id = pg_temp.link_of('Twitch') returning id $$,
  'un cliente MCP no lo cambia');

select pg_temp.as_anon();
select is(
  (select l ->> 'placement'
   from public.public_page_v v, jsonb_array_elements(v.sections) s, jsonb_array_elements(s -> 'links') l
   where v.handle = 'juedsay' and l ->> 'title' = 'Instagram'),
  'icon', 'la vista pública expone el lugar de cada link');
select is(
  (select l ->> 'placement'
   from public.public_page_v v, jsonb_array_elements(v.sections) s, jsonb_array_elements(s -> 'links') l
   where v.handle = 'juedsay' and l ->> 'title' = 'Twitch'),
  'list', 'los demás siguen en la lista');

select * from finish();
rollback;
