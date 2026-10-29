-- Tipo de link (tarea 37b, SPEC-link-form "Entrega 7b"): `null` es automático.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

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
  (select count(*)::int from public.links where kind is not null), 0,
  'los links existentes quedaron en automático (sin tipo guardado)');

select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ update public.links set kind = 'article' where id = pg_temp.link_of('Cómo testeo RLS con pgTAP') $$,
  'el dueño fija el tipo');
select lives_ok(
  $$ insert into public.links (owner_id, page_id, title, url, kind)
     values ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
             'Una charla', 'https://youtu.be/abc', 'video') $$,
  'y lo elige al crear el link');
select throws_ok(
  $$ update public.links set kind = 'podcast' where id = pg_temp.link_of('Twitch') $$,
  '22P02', null, 'un tipo que no existe se rechaza');
select is_empty(
  $$ update public.links set kind = 'video' where id = pg_temp.link_of('Link de prueba número 1') returning id $$,
  'no cambia el tipo de un link ajeno');

select pg_temp.login('11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-00000000000e');
select is_empty(
  $$ update public.links set kind = 'video' where id = pg_temp.link_of('Twitch') returning id $$,
  'un cliente MCP no lo cambia escribiendo directo en la tabla');

select pg_temp.as_anon();
select is(
  (select l ->> 'kind'
   from public.public_page_v v, jsonb_array_elements(v.sections) s, jsonb_array_elements(s -> 'links') l
   where v.handle = 'juedsay' and l ->> 'title' = 'Cómo testeo RLS con pgTAP'),
  'article', 'la vista pública expone el tipo elegido');

select * from finish();
rollback;
