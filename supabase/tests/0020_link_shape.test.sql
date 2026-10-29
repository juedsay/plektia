-- Forma de los links de la página (tarea 36b, SPEC-appearance "Entrega 6b").
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

select is(
  (select count(*)::int from public.pages where link_shape <> 'rows'), 0,
  'las páginas existentes quedaron en filas (el aspecto de siempre)');

select pg_temp.as_anon();
select is(
  (select link_shape from public.public_page_v where handle = 'juedsay'), 'rows'::public.link_shape,
  'la vista pública expone la forma');

select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ update public.pages set link_shape = 'cards' where id = '11111111-1111-4111-8111-111111111111' $$,
  'el dueño elige tarjetas');
select is(
  (select link_shape from public.pages where id = '11111111-1111-4111-8111-111111111111'),
  'cards'::public.link_shape, 'quedó en tarjetas');
select throws_ok(
  $$ update public.pages set link_shape = 'hexagons' where id = '11111111-1111-4111-8111-111111111111' $$,
  '22P02', null, 'una forma que no existe se rechaza');
select is_empty(
  $$ update public.pages set link_shape = 'pills' where id = '22222222-2222-4222-8222-222222222222' returning id $$,
  'no cambia la forma de una página ajena');

select pg_temp.login('11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-00000000000e');
select is_empty(
  $$ update public.pages set link_shape = 'pills' where id = '11111111-1111-4111-8111-111111111111' returning id $$,
  'un cliente MCP no cambia la forma');

reset role;
insert into public.pages (handle, display_name, owner_id)
values ('forma-nueva', 'Nueva', '11111111-1111-4111-8111-111111111111');
select is(
  (select link_shape from public.pages where handle = 'forma-nueva'), 'rows'::public.link_shape,
  'una página nueva empieza en filas');

select * from finish();
rollback;
