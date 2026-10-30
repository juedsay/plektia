-- Rótulo de sección (tarea 38d): reemplaza al automático del estilo; `null` es el automático.
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

select is(
  (select count(*)::int from public.sections where label is not null), 0,
  'las secciones existentes quedaron con el rótulo automático');

select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ update public.sections set label = 'Cara 1' where title = 'Redes' $$,
  'el dueño escribe un rótulo');
select throws_ok(
  $$ update public.sections set label = repeat('a', 17) where title = 'Redes' $$,
  '23514', null, 'un rótulo de más de 16 caracteres se rechaza');
select throws_ok(
  $$ update public.sections set label = '   ' where title = 'Redes' $$,
  '23514', null, 'un rótulo en blanco se rechaza (el automático es null)');
select throws_ok(
  $$ update public.sections set label = E'Lado\nA' where title = 'Redes' $$,
  '23514', null, 'un rótulo con saltos de línea se rechaza');
select is_empty(
  $$ update public.sections set label = 'Ajeno' where title = 'Sección 1' returning id $$,
  'no cambia el rótulo de una sección ajena');

select pg_temp.login('11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-00000000000e');
select is_empty(
  $$ update public.sections set label = 'MCP' where title = 'Redes' returning id $$,
  'un cliente MCP no lo cambia escribiendo directo en la tabla');

select set_config('role', 'anon', true), set_config('request.jwt.claims', '', true);
select is(
  (select s ->> 'label'
   from public.public_page_v v, jsonb_array_elements(v.sections) s
   where v.handle = 'juedsay' and s ->> 'title' = 'Redes'),
  'Cara 1', 'la vista pública expone el rótulo');

select * from finish();
rollback;
