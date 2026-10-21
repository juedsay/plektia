-- Contacto: solo el Worker (service_role) guarda mensajes; nadie más los lee ni escribe.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

create function pg_temp.as_anon()
returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '', true);
$$;

delete from private.contact_messages;

select ok(
  not has_function_privilege('anon', 'public.ingest_contact_message(text, text, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.ingest_contact_message(text, text, text)', 'execute'),
  'ni anon ni un usuario con sesión pueden guardar mensajes (solo el Worker)');
select ok(
  has_function_privilege('service_role', 'public.ingest_contact_message(text, text, text)', 'execute'),
  'service_role sí puede');
select ok(
  not has_table_privilege('anon', 'private.contact_messages', 'select,insert,update,delete')
    and not has_table_privilege('authenticated', 'private.contact_messages', 'select,insert,update,delete'),
  'la tabla no es accesible para anon ni authenticated');

select pg_temp.as_anon();
select throws_ok(
  $$ select public.ingest_contact_message('Bot', 'bot@spam.test', 'hola') $$,
  '42501', null, 'anon no puede llamar a la función');
reset role;

set local role service_role;
select lives_ok(
  $$ select public.ingest_contact_message('Ana', 'ana@example.com', 'Quiero una invitación') $$,
  'el Worker guarda un mensaje válido');
reset role;
select is((select count(*)::int from private.contact_messages), 1, 'queda guardado');
select is((select name from private.contact_messages), 'Ana', 'con los datos tal cual');

set local role service_role;
select throws_ok(
  $$ select public.ingest_contact_message('Ana', 'no-es-un-email', 'x') $$,
  '23514', null, 'un email inválido lo frena la base aunque se saltee el dominio');
select throws_ok(
  $$ select public.ingest_contact_message('Ana', 'ana@example.com', repeat('a', 2001)) $$,
  '23514', null, 'un mensaje de más de 2000 caracteres también');
select throws_ok(
  $$ select public.ingest_contact_message('', 'ana@example.com', 'x') $$,
  '23514', null, 'y un nombre vacío');
reset role;

-- Tope global: 100 por hora.
insert into private.contact_messages (name, email, message)
select 'n', 'n@example.com', 'm' from generate_series(1, 99);
set local role service_role;
select throws_ok(
  $$ select public.ingest_contact_message('Ana', 'ana@example.com', 'uno más') $$,
  'PL429', null, 'con 100 mensajes en la última hora rechaza el siguiente');
reset role;

-- `/contact`, `/contacto` (redirige) y `/privacidad` son rutas propias: no pueden ser el handle de nadie.
select throws_ok($$ select 'contacto'::public.handle $$, '23514', null, 'contacto es un handle reservado');
select throws_ok($$ select 'contact'::public.handle $$, '23514', null, 'contact es un handle reservado');
select throws_ok($$ select 'privacidad'::public.handle $$, '23514', null, 'privacidad es un handle reservado');

select lives_ok($$ select private.assert_no_reserved_handles_in_use() $$,
  'ningún perfil ni invitación usa un handle reservado');

-- Si una palabra recién reservada ya está en uso, el control frena (y dice cuál).
-- Se simula reservando `juedsay`, el perfil del seed; el rollback lo deshace.
create or replace function private.is_reserved_handle(value text)
returns boolean language sql immutable set search_path = ''
as $$ select lower(value) = 'juedsay' $$;
select throws_like($$ select private.assert_no_reserved_handles_in_use() $$,
  '%handles reservados en uso: juedsay%',
  'con un handle reservado en uso, la migración se frena');

select * from finish();
rollback;
