-- Dar de baja una cuenta cierra sus sesiones y desconecta sus apps de IA; la
-- de otra cuenta no se toca.
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

create function pg_temp.login(uid uuid)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Seed: owner 1111… (/juedsay), miembro 2222… (/miembro-demo). Cada uno con una
-- sesión abierta y una app conectada.
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('5e550000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', now(), now()),
  ('5e550000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', now(), now());
insert into public.mcp_grants (client_id, user_id, client_name, redirect_host, can_write) values
  ('c1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'App', 'app.example', true),
  ('c1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'App', 'app.example', true);

select pg_temp.login('11111111-1111-4111-8111-111111111111');
select is(
  (select status from public.admin_revoke('member@plektia.test')),
  'revoked', 'el owner da de baja al miembro');
reset role;

select is(
  (select count(*)::int from auth.sessions where user_id = '22222222-2222-4222-8222-222222222222'),
  0, 'sus sesiones se cierran');
select isnt(
  (select revoked_at from public.mcp_grants where client_id = 'c1000000-0000-4000-8000-000000000001'),
  null, 'su app conectada queda desconectada');
select is(
  (select count(*)::int from auth.sessions where id = '5e550000-0000-4000-8000-000000000002'),
  1, 'la sesión del owner sigue');
select is(
  (select revoked_at from public.mcp_grants where client_id = 'c1000000-0000-4000-8000-000000000002'),
  null, 'y su app también');

select * from finish();
rollback;
