-- Identity: tabla de amenazas de SPEC-identity (registro cerrado, escalada de rol,
-- perfil ajeno, lectura de la allowlist) más el formato de handles.
begin;
create extension if not exists pgtap with schema extensions;

select plan(39);

-- Evento de prueba del hook, con la forma de auth.users.
create function pg_temp.event(email text, provider text, verified boolean)
returns jsonb language sql as $$
  select jsonb_build_object('user', jsonb_build_object(
    'email', email,
    'app_metadata', jsonb_build_object('provider', provider),
    'user_metadata', jsonb_build_object('email_verified', verified)
  ));
$$;

-- Simula una sesión de Supabase: rol de la API y claims del JWT.
create function pg_temp.login(uid uuid, client_id text default null)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', 'authenticated', 'client_id', client_id))::text,
           true);
$$;

-- Visitante anónimo. Borra los claims: `reset role` no los limpia, y un
-- "anónimo" con los claims del usuario anterior vería lo de ese usuario.
create function pg_temp.as_anon()
returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '', true);
$$;

-- Usuarios del seed: owner 1111…, miembro 2222….

-- ── Hook before_user_created ─────────────────────────────────────────────────
-- Lo ejecuta Supabase Auth como supabase_auth_admin, y nadie más.
select ok(
  has_function_privilege('supabase_auth_admin', 'private.before_user_created(jsonb)', 'execute')
    and has_table_privilege('supabase_auth_admin', 'private.allowed_emails', 'select'),
  'hook: supabase_auth_admin puede ejecutarlo y leer la allowlist');
select ok(
  not has_function_privilege('anon', 'private.before_user_created(jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'private.before_user_created(jsonb)', 'execute'),
  'hook: anon y authenticated no lo pueden ejecutar');
select ok(
  not has_table_privilege('supabase_auth_admin', 'private.allowed_emails', 'insert,update,delete'),
  'hook: supabase_auth_admin solo lee la allowlist');

select is(private.before_user_created(pg_temp.event('owner@plektia.test', 'github', true)),
  '{}'::jsonb, 'hook: acepta un email invitado y verificado por GitHub');
select is(private.before_user_created(pg_temp.event('member@plektia.test', 'google', true)),
  '{}'::jsonb, 'hook: acepta un email invitado y verificado por Google');
select is(private.before_user_created(pg_temp.event('  Owner@Plektia.TEST ', 'github', true)),
  '{}'::jsonb, 'hook: ignora mayúsculas y espacios del email');
select is(private.before_user_created(pg_temp.event('intruso@plektia.test', 'github', true)) -> 'error' ->> 'http_code',
  '403', 'hook: rechaza un email que no está en la allowlist');
select is(private.before_user_created(pg_temp.event('owner@plektia.test', 'github', false)) -> 'error' ->> 'http_code',
  '403', 'hook: rechaza un email invitado pero no verificado');
select is(private.before_user_created(pg_temp.event('owner@plektia.test', 'email', true)) -> 'error' ->> 'http_code',
  '403', 'hook: rechaza email y contraseña aunque diga verificado');
select is(private.before_user_created(jsonb_build_object('user', jsonb_build_object('email', 'owner@plektia.test', 'app_metadata', '{"provider":"github"}'::jsonb))) -> 'error' ->> 'http_code',
  '403', 'hook: rechaza si el proveedor no informa la verificación');
select is(private.before_user_created(pg_temp.event('intruso@plektia.test', 'github', true)) -> 'error' ->> 'message',
  private.before_user_created(pg_temp.event('owner@plektia.test', 'github', false)) -> 'error' ->> 'message',
  'hook: mismo mensaje para cualquier rechazo (sin enumeración)');

-- ── Trigger de perfil ────────────────────────────────────────────────────────
select results_eq(
  $$ select handle::text, role::text, display_name from public.profiles order by handle $$,
  $$ values ('juedsay', 'owner', 'Julián (dev)'), ('miembro-demo', 'member', 'Miembro Demo') $$,
  'trigger: cada usuario invitado tiene su perfil con el handle y el rol de la invitación');

select throws_ok(
  $$ insert into auth.users (instance_id, id, aud, role, email)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'nadie@plektia.test') $$,
  '42501', null,
  'trigger: un usuario sin invitación no se crea (aunque saltee el hook)');

insert into private.allowed_emails (email, handle) values ('sin-nombre@plektia.test', 'sin-nombre');
insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'sin-nombre@plektia.test');
select is((select display_name from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  'sin-nombre', 'trigger: sin nombre del proveedor, el nombre visible es el handle');

-- ── Handles ──────────────────────────────────────────────────────────────────
select lives_ok($$ select 'ana-23'::public.handle $$, 'handle: acepta minúsculas, números y guion');
select throws_ok($$ select 'ab'::public.handle $$, '23514', null, 'handle: rechaza menos de 3 caracteres');
select throws_ok($$ select repeat('a', 31)::public.handle $$, '23514', null, 'handle: rechaza más de 30 caracteres');
select throws_ok($$ select 'ana--b'::public.handle $$, '23514', null, 'handle: rechaza guiones dobles');
select throws_ok($$ select '-ana'::public.handle $$, '23514', null, 'handle: rechaza guion al principio');
select throws_ok($$ select 'ana_b'::public.handle $$, '23514', null, 'handle: rechaza guion bajo');
select throws_ok($$ select 'añá'::public.handle $$, '23514', null, 'handle: rechaza letras fuera de a-z');
select throws_ok($$ select 'Admin'::public.handle $$, '23514', null, 'handle: rechaza rutas reservadas sin importar mayúsculas');
select throws_ok($$ select 'plektia'::public.handle $$, '23514', null, 'handle: plektia está reservado');
select throws_ok($$ select 'JuedSay'::public.handle $$, '23514', null, 'handle: se guarda solo en minúsculas');
select throws_ok(
  $$ insert into private.allowed_emails (email, handle) values ('otra@plektia.test', 'juedsay') $$,
  '23505', null, 'handle: es único');
select ok((select exists (select 1 from public.profiles where handle = 'JUEDSAY')),
  'handle: se busca sin importar mayúsculas (/JuedSay encuentra a juedsay)');

-- ── Allowlist privada ────────────────────────────────────────────────────────
select ok(
  not has_table_privilege('anon', 'private.allowed_emails', 'select,insert,update,delete')
    and not has_table_privilege('authenticated', 'private.allowed_emails', 'select,insert,update,delete'),
  'allowlist: anon y authenticated no tienen privilegios sobre la tabla');
select pg_temp.as_anon();
select throws_ok($$ select * from private.allowed_emails $$, '42501', null, 'allowlist: anon no la puede leer');
reset role;
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select throws_ok($$ select * from private.allowed_emails $$, '42501', null, 'allowlist: authenticated no la puede leer');
reset role;

-- ── RLS de profiles ──────────────────────────────────────────────────────────
update public.profiles set disabled = true where id = '33333333-3333-4333-8333-333333333333';

select pg_temp.as_anon();
select is((select count(*)::int from public.profiles), 2, 'perfiles: anon ve los activos y no los dados de baja');
select throws_ok($$ update public.profiles set bio = 'x' $$, '42501', null, 'perfiles: anon no puede editar');
reset role;

select pg_temp.login('22222222-2222-4222-8222-222222222222');
update public.profiles set bio = 'Hola' where id = '22222222-2222-4222-8222-222222222222';
update public.profiles set bio = 'hackeado' where id = '11111111-1111-4111-8111-111111111111';
reset role;
select is((select bio from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'Hola', 'perfiles: el dueño edita su bio');
select is((select bio from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  null, 'perfiles: nadie edita el perfil de otro usuario');

select pg_temp.login('22222222-2222-4222-8222-222222222222');
select throws_ok($$ update public.profiles set role = 'owner' where id = auth.uid() $$,
  '42501', null, 'perfiles: un miembro no se puede dar rol de owner');
select throws_ok($$ update public.profiles set handle = 'nuevo' where id = auth.uid() $$,
  '42501', null, 'perfiles: nadie se cambia el handle');
select throws_ok($$ update public.profiles set disabled = false where id = auth.uid() $$,
  '42501', null, 'perfiles: nadie se reactiva solo');
select throws_ok($$ insert into public.profiles (id, handle, display_name) values (auth.uid(), 'otro', 'x') $$,
  '42501', null, 'perfiles: nadie crea perfiles por la API');
reset role;

-- Un cliente MCP (JWT con client_id) no escribe directo en las tablas.
select pg_temp.login('22222222-2222-4222-8222-222222222222', 'cliente-mcp');
update public.profiles set bio = 'desde MCP' where id = '22222222-2222-4222-8222-222222222222';
reset role;
select is((select bio from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'Hola', 'perfiles: un token de cliente MCP no edita por la API directa');

-- Un usuario dado de baja no puede editar.
select pg_temp.login('33333333-3333-4333-8333-333333333333');
update public.profiles set bio = 'sigo acá' where id = '33333333-3333-4333-8333-333333333333';
reset role;
select is((select bio from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  null, 'perfiles: un usuario dado de baja no edita su perfil');

select * from finish();
rollback;
