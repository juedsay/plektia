-- Tipografía de los nombres de la página (tarea 36c, SPEC-appearance "Entrega 6b").
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
  (select count(*)::int from public.pages where name_font <> 'bricolage'), 0,
  'las páginas existentes quedaron en bricolage (la de la marca)');

select pg_temp.as_anon();
select is(
  (select name_font from public.public_page_v where handle = 'juedsay'), 'bricolage'::public.name_font,
  'la vista pública expone la tipografía');

select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ update public.pages set name_font = 'fraunces' where id = '11111111-1111-4111-8111-111111111111' $$,
  'el dueño elige Fraunces');
select is(
  (select name_font from public.pages where id = '11111111-1111-4111-8111-111111111111'),
  'fraunces'::public.name_font, 'quedó en Fraunces');
select throws_ok(
  $$ update public.pages set name_font = 'comic_sans' where id = '11111111-1111-4111-8111-111111111111' $$,
  '22P02', null, 'una fuente fuera de la lista se rechaza');
select is_empty(
  $$ update public.pages set name_font = 'nunito' where id = '22222222-2222-4222-8222-222222222222' returning id $$,
  'no cambia la tipografía de una página ajena');

select pg_temp.login('11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-00000000000e');
select is_empty(
  $$ update public.pages set name_font = 'nunito' where id = '11111111-1111-4111-8111-111111111111' returning id $$,
  'un cliente MCP no cambia la tipografía');

reset role;
insert into public.pages (handle, display_name, owner_id)
values ('fuente-nueva', 'Nueva', '11111111-1111-4111-8111-111111111111');
select is(
  (select name_font from public.pages where handle = 'fuente-nueva'), 'bricolage'::public.name_font,
  'una página nueva empieza en bricolage');

select * from finish();
rollback;
