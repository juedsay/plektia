-- "Editado desde Claude" (SPEC-mcp-server, historia 5).
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

create function pg_temp.login(uid uuid, client_id text default null)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', 'authenticated', 'client_id', client_id))::text,
           true);
$$;

-- Una app conectada por el dueño 1111… que editó "Twitch" hace 5 minutos (y
-- "YouTube" hace dos horas).
insert into public.mcp_grants (client_id, user_id, client_name, redirect_host, can_write)
values ('e0000000-0000-4000-8000-00000000001e', '11111111-1111-4111-8111-111111111111',
        'Claude', 'claude.ai', true);
insert into private.mcp_audit_log (user_id, client_id, tool, target_id, created_at)
select '11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-00000000001e',
       'update_link', id, now() - interval '5 minutes'
from public.links where title = 'Twitch';
insert into private.mcp_audit_log (user_id, client_id, tool, target_id, created_at)
select '11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-00000000001e',
       'update_link', id, now() - interval '2 hours'
from public.links where title = 'YouTube';

select pg_temp.login('11111111-1111-4111-8111-111111111111');
select is(
  (select client_name from public.mcp_last_edit((select id from public.links where title = 'Twitch'))),
  'Claude', 'el dueño ve qué app cambió el link');
select is_empty(
  $$ select * from public.mcp_last_edit((select id from public.links where title = 'YouTube')) $$,
  'lo de hace más de una hora no cuenta');
select is_empty(
  $$ select * from public.mcp_last_edit((select id from public.links where title = 'Instagram')) $$,
  'un link que no tocó ninguna app, nada');

select pg_temp.login('22222222-2222-4222-8222-222222222222');
select is_empty(
  $$ select * from public.mcp_last_edit((select id from public.links where title = 'Twitch')) $$,
  'otra cuenta no ve la auditoría ajena');

select pg_temp.login('11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-00000000001e');
select throws_ok(
  $$ select * from public.mcp_last_edit((select id from public.links where title = 'Twitch')) $$,
  '42501', null, 'un cliente MCP no lee la auditoría');

select set_config('role', 'anon', true);
select throws_ok(
  $$ select * from public.mcp_last_edit('00000000-0000-4000-8000-000000000000') $$,
  '42501', null, 'el público no la puede llamar');

select * from finish();
rollback;
