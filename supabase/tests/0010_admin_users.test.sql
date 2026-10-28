-- Usuarios habilitados: solo un owner invita, quita el acceso y ve la lista;
-- nadie se quita el acceso a sí mismo; todo queda en la auditoría; una cuenta
-- dada de baja deja de publicarse y no puede escribir.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

create function pg_temp.login(uid uuid)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.as_anon()
returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '', true);
$$;

-- Seed: owner 1111… (/juedsay), miembro 2222… (/miembro-demo).

-- ── Un member o anon no pueden nada ─────────────────────────────────────────
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select throws_ok($$ select public.admin_invite('nueva@plektia.test', 'nueva') $$,
  '42501', null, 'un member no puede invitar');
select throws_ok($$ select * from public.admin_revoke('owner@plektia.test') $$,
  '42501', null, 'un member no puede quitar el acceso');
select throws_ok($$ select * from public.admin_list_users() $$,
  '42501', null, 'un member no ve los usuarios');
select throws_ok($$ select * from private.audit_log $$,
  '42501', null, 'un member no lee la auditoría');
reset role;

select pg_temp.as_anon();
select throws_ok($$ select public.admin_invite('nueva@plektia.test', 'nueva') $$,
  '42501', null, 'anon no puede invitar');
reset role;

-- ── El owner invita ─────────────────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select is(public.admin_invite('  Nueva@Plektia.test ', 'Nueva-Persona'), 'invited',
  'el owner invita (email y handle normalizados)');
select is(public.admin_invite('nueva@plektia.test', 'otro-handle'), 'email_taken',
  'el mismo email no se invita dos veces');
select is(public.admin_invite('member@plektia.test', 'otro-handle'), 'email_taken',
  'tampoco el email de una cuenta que ya existe');
select is(public.admin_invite('otra@plektia.test', 'nueva-persona'), 'handle_taken',
  'un handle ya invitado está tomado');
select is(public.admin_invite('otra@plektia.test', 'miembro-demo'), 'handle_taken',
  'un handle de una página está tomado');
select is(public.admin_invite('otra@plektia.test', 'admin'), 'invalid_handle',
  'un handle reservado no se invita');
select is(public.admin_invite('otra@plektia.test', 'plektia'), 'invalid_handle',
  'el handle oficial no se invita');
select is(public.admin_invite('otra@plektia.test', 'a'), 'invalid_handle',
  'un handle mal formado no se invita');
select is(public.admin_invite('no-es-un-email', 'otra'), 'invalid_email',
  'un email mal formado no se invita');

reset role;

-- El handle invitado queda reservado: otra cuenta no lo puede tomar antes.
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$ insert into public.pages (handle, display_name) values ('nueva-persona', 'Copia') $$,
  '23505', null, 'nadie toma el handle de una invitación pendiente');
reset role;
select pg_temp.login('11111111-1111-4111-8111-111111111111');

select results_eq(
  $$ select email, handle, role::text, status from public.admin_list_users()
     where email in ('nueva@plektia.test', 'member@plektia.test') order by email $$,
  $$ values ('member@plektia.test', 'miembro-demo', 'member', 'active'),
            ('nueva@plektia.test', 'nueva-persona', 'member', 'invited') $$,
  'el owner ve las invitaciones y las cuentas');

-- ── El owner quita el acceso ────────────────────────────────────────────────
select results_eq(
  $$ select status, handles from public.admin_revoke('owner@plektia.test') $$,
  $$ values ('self', array[]::text[]) $$,
  'nadie se quita el acceso a sí mismo (nunca queda la plataforma sin owner)');
select results_eq(
  $$ select status, handles from public.admin_revoke('member@plektia.test') $$,
  $$ values ('revoked', array['miembro-demo']) $$,
  'quita el acceso a una cuenta y devuelve sus páginas (para la caché)');
select results_eq(
  $$ select status from public.admin_revoke('nadie@plektia.test') $$,
  $$ values ('not_found') $$,
  'un email desconocido no es nada');
select is(
  (select status from public.admin_list_users() where email = 'member@plektia.test'),
  'disabled', 'la cuenta queda dada de baja');
reset role;

select is(
  (select array_agg(action || ':' || target_email::text order by id) from private.audit_log),
  array['invite:nueva@plektia.test', 'revoke:member@plektia.test'],
  'auditoría: cada operación del owner, con quién y a quién');

-- ── Una cuenta dada de baja no se publica ni escribe ────────────────────────
select pg_temp.as_anon();
select is((select count(*)::int from public.public_page_v where handle = 'miembro-demo'), 0,
  'su página deja de publicarse');
reset role;

select pg_temp.login('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$ insert into public.links (page_id, title, url)
     values ('22222222-2222-4222-8222-222222222222', 'Después', 'https://plektia.app') $$,
  '42501', null, 'con la sesión abierta, ya no puede escribir');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '22222222-2222-4222-8222-222222222222/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.webp') $$,
  '42501', null, 'ni subir avatares a Storage');
reset role;

-- El alta toma la invitación con bloqueo (se serializa con una baja simultánea).
select ok(
  pg_get_functiondef('private.create_profile_for_new_user()'::regprocedure) ~ 'for share',
  'el alta bloquea la invitación mientras crea la cuenta');

select * from finish();
rollback;
