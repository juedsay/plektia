-- Links destacados (tarea 36e, SPEC-appearance "Entrega 6b").
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

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
  (select count(*)::int from public.links where highlight <> 'none'), 0,
  'los links existentes quedaron sin destacar');

select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ update public.links set highlight = 'accent' where id = pg_temp.link_of('Twitch') $$,
  'el dueño destaca un link con el acento');
select lives_ok(
  $$ update public.links set highlight = 'top'
     where id in (pg_temp.link_of('YouTube'), pg_temp.link_of('Instagram'), pg_temp.link_of('GitHub')) $$,
  'y tres arriba de todo');
select throws_ok(
  $$ update public.links set highlight = 'top' where id = pg_temp.link_of('Plektia') $$,
  'PL429', null, 'un cuarto arriba de todo supera el límite');
select lives_ok(
  $$ update public.links set highlight = 'top', title = 'GitHub' where id = pg_temp.link_of('GitHub') $$,
  'volver a guardar uno que ya está arriba no cuenta como otro');
select lives_ok(
  $$ update public.links set highlight = 'none' where id = pg_temp.link_of('GitHub');
     update public.links set highlight = 'top' where id = pg_temp.link_of('Plektia') $$,
  'sacando uno, entra otro');
select throws_ok(
  $$ update public.links set highlight = 'glow' where id = pg_temp.link_of('Twitch') $$,
  '22P02', null, 'un estilo que no existe se rechaza');
select is_empty(
  $$ update public.links set highlight = 'top' where id = pg_temp.link_of('Link de prueba número 1') returning id $$,
  'no destaca un link ajeno');

select pg_temp.login('11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-00000000000e');
select is_empty(
  $$ update public.links set highlight = 'none' where id = pg_temp.link_of('Twitch') returning id $$,
  'un cliente MCP no lo cambia');

select pg_temp.as_anon();
select is(
  (select l ->> 'highlight'
   from public.public_page_v v, jsonb_array_elements(v.sections) s, jsonb_array_elements(s -> 'links') l
   where v.handle = 'juedsay' and l ->> 'title' = 'YouTube'),
  'top', 'la vista pública expone el destacado');
select is(
  (select l ->> 'highlight'
   from public.public_page_v v, jsonb_array_elements(v.sections) s, jsonb_array_elements(s -> 'links') l
   where v.handle = 'juedsay' and l ->> 'title' = 'Twitch'),
  'accent', 'y el de acento');

select * from finish();
rollback;
