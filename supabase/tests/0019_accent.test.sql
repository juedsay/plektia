-- Color de acento de la página (tarea 36a, SPEC-appearance "Entrega 6b").
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
  (select count(*)::int from public.pages where accent <> 'hueso'), 0,
  'las páginas existentes quedaron en hueso (el aspecto de siempre)');

select pg_temp.as_anon();
select is(
  (select accent from public.public_page_v where handle = 'juedsay'), 'hueso'::public.accent_color,
  'la vista pública expone el acento');

select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ update public.pages set accent = 'turquesa' where id = '11111111-1111-4111-8111-111111111111' $$,
  'el dueño elige un acento');
select is(
  (select accent from public.pages where id = '11111111-1111-4111-8111-111111111111'),
  'turquesa'::public.accent_color, 'quedó en turquesa');
select throws_ok(
  $$ update public.pages set accent = '#ff0000' where id = '11111111-1111-4111-8111-111111111111' $$,
  '22P02', null, 'un color libre se rechaza');
select is_empty(
  $$ update public.pages set accent = 'coral' where id = '22222222-2222-4222-8222-222222222222' returning id $$,
  'no cambia el acento de una página ajena');

select pg_temp.login('11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-00000000000e');
select is_empty(
  $$ update public.pages set accent = 'coral' where id = '11111111-1111-4111-8111-111111111111' returning id $$,
  'un cliente MCP no cambia el acento');

reset role;
insert into public.pages (handle, display_name, owner_id)
values ('acento-nuevo', 'Nueva', '11111111-1111-4111-8111-111111111111');
select is(
  (select accent from public.pages where handle = 'acento-nuevo'), 'hueso'::public.accent_color,
  'una página nueva empieza en hueso');

select * from finish();
rollback;
