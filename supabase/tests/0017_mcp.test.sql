-- MCP (tarea 29, SPEC-mcp-server): un JWT con `client_id` no escribe directo;
-- por las funciones `mcp_*` escribe solo con un grant activo y `can_write`, en
-- lo propio y con auditoría. Las conexiones se manejan solo desde el panel.
begin;
create extension if not exists pgtap with schema extensions;

select plan(46);

create function pg_temp.login(uid uuid, client_id text default null)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', 'authenticated', 'client_id', client_id))::text,
           true);
$$;

-- Dueño 1111… (página 1111…), miembro 2222… (página 2222…).
-- Conexiones del dueño: E (edición), L (solo lectura), R (revocada). Del miembro: M.
insert into public.mcp_grants (client_id, user_id, client_name, redirect_host, can_write, revoked_at) values
  ('e0000000-0000-4000-8000-00000000000e', '11111111-1111-4111-8111-111111111111', 'Claude', 'claude.ai', true, null),
  ('10000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', 'Lector', 'lector.example', false, null),
  ('a0000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', 'Vieja', 'vieja.example', true, now()),
  ('b0000000-0000-4000-8000-00000000000b', '22222222-2222-4222-8222-222222222222', 'Claude', 'claude.ai', true, null);

insert into public.links (id, owner_id, page_id, title, url, provider, provider_handle) values
  ('c1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-111111111111', 'Canal', 'https://www.youtube.com/@canal', 'youtube', '@canal'),
  ('c1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-111111111111', 'Blog', 'https://ejemplo.com', 'generic', null);

-- ── Solo lectura ─────────────────────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ insert into public.links (page_id, title, url)
     values ('11111111-1111-4111-8111-111111111111', 'Directo', 'https://ejemplo.com') $$,
  '42501', null, 'con client_id no se inserta directo en la tabla');
select is_empty(
  $$ update public.links set title = 'Directo' where id = 'c1000000-0000-4000-8000-000000000002' returning id $$,
  'con client_id no se edita directo en la tabla');
select is(public.mcp_authorize(), false, 'la conexión de solo lectura está activa y no escribe');
select throws_ok(
  $$ select public.mcp_authorize(true) $$, '42501', null, 'exigir escritura a una de solo lectura falla');
select throws_ok(
  $$ select public.mcp_create_link('11111111-1111-4111-8111-111111111111', null, null, 'Nuevo',
       'https://ejemplo.com', null, 'generic', null, null, true) $$,
  '42501', null, 'solo lectura no crea por mcp_*');
select throws_ok(
  $$ select public.mcp_update_link('11111111-1111-4111-8111-111111111111',
       'c1000000-0000-4000-8000-000000000002', 1, '{"title": "X"}') $$,
  '42501', null, 'solo lectura no edita por mcp_*');
select throws_ok(
  $$ select public.mcp_reorder_sections('11111111-1111-4111-8111-111111111111', '{}', '{}') $$,
  '42501', null, 'solo lectura no reordena por mcp_*');
select is_empty(
  $$ update public.mcp_grants set can_write = true returning client_id $$,
  'un cliente no se da permiso de escritura');
select is((select count(*)::int from public.mcp_grants), 0, 'un cliente no ve las conexiones');
select throws_ok(
  $$ select public.mcp_save_grant('10000000-0000-4000-8000-00000000000a', 'Lector', 'lector.example', true) $$,
  '42501', null, 'un cliente no se re-autoriza a sí mismo');
select ok(
  (select count(*) from public.links where page_id = '11111111-1111-4111-8111-111111111111') > 0,
  'lee sus links (RLS)');

-- ── Sin conexión válida ──────────────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-00000000000a');
select throws_ok($$ select public.mcp_authorize() $$, '42501', null, 'una conexión revocada no pasa');
select pg_temp.login('11111111-1111-4111-8111-111111111111', 'ffffffff-0000-4000-8000-00000000000f');
select throws_ok($$ select public.mcp_authorize() $$, '42501', null, 'un cliente sin grant no pasa');
select pg_temp.login('11111111-1111-4111-8111-111111111111', 'cliente-mcp');
select throws_ok($$ select public.mcp_authorize() $$, '42501', null, 'un client_id que no es uuid no pasa');
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$ select public.mcp_create_link('11111111-1111-4111-8111-111111111111', null, null, 'Nuevo',
       'https://ejemplo.com', null, 'generic', null, null, true) $$,
  '42501', null, 'el panel no usa las funciones mcp_*');
select pg_temp.login('22222222-2222-4222-8222-222222222222', 'e0000000-0000-4000-8000-00000000000e');
select throws_ok(
  $$ select public.mcp_authorize() $$, '42501', null, 'el grant de un usuario no sirve con el token de otro');

-- ── Edición ──────────────────────────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-00000000000e');
select is(public.mcp_authorize(true), true, 'la conexión de edición escribe');
select is(
  (public.mcp_create_link('11111111-1111-4111-8111-111111111111', 'c1000000-0000-4000-8000-0000000000aa',
     null, 'Mi video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', null, 'generic', null,
     array['video'], true)).owner_id,
  '11111111-1111-4111-8111-111111111111'::uuid, 'crea un link a su nombre');
select is(
  (public.mcp_create_link('11111111-1111-4111-8111-111111111111', 'c1000000-0000-4000-8000-0000000000aa',
     null, 'Mi video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', null, 'generic', null,
     array['video'], true)).title,
  'Mi video', 'repetir el alta con el mismo id devuelve el mismo link');
select is(
  (select count(*)::int from public.links where id = 'c1000000-0000-4000-8000-0000000000aa'), 1,
  'y no lo duplica');
select throws_ok(
  $$ select public.mcp_create_link('22222222-2222-4222-8222-222222222222', null, null, 'Ajeno',
       'https://ejemplo.com', null, 'generic', null, null, true) $$,
  'PL404', null, 'no crea en la página de otro');
select throws_ok(
  $$ select public.mcp_create_link('11111111-1111-4111-8111-111111111111', null, null, 'Malo',
       'javascript:alert(1)', null, 'generic', null, null, true) $$,
  '23514', null, 'los mismos checks de la tabla (URL)');

select throws_ok(
  $$ select public.mcp_update_link('11111111-1111-4111-8111-111111111111',
       'c1000000-0000-4000-8000-0000000000aa', 99, '{"title": "Otro"}') $$,
  'PL409', null, 'editar con una versión vieja es un conflicto');
select throws_ok(
  $$ select public.mcp_update_link('11111111-1111-4111-8111-111111111111',
       'c1000000-0000-4000-8000-0000000000aa', 1, '{"owner_id": "22222222-2222-4222-8222-222222222222"}') $$,
  'PL400', null, 'no acepta claves desconocidas (ni el dueño)');
select is(
  (public.mcp_update_link('11111111-1111-4111-8111-111111111111', 'c1000000-0000-4000-8000-0000000000aa', 1,
     '{"title": "Mi video nuevo", "description": null, "tags": ["video", "nuevo"]}')).tags,
  array['video', 'nuevo'], 'edita solo las claves presentes');
select throws_ok(
  $$ select public.mcp_update_link('22222222-2222-4222-8222-222222222222',
       'c1000000-0000-4000-8000-0000000000aa', 2, '{"title": "X"}') $$,
  'PL404', null, 'con la página de otro, el link no existe');

select throws_ok(
  $$ select public.mcp_delete_link('11111111-1111-4111-8111-111111111111',
       'c1000000-0000-4000-8000-0000000000aa', 2, 'Mi video') $$,
  'PL400', null, 'borrar con un título que no coincide no borra');
select is(
  (select count(*)::int from public.links where id = 'c1000000-0000-4000-8000-0000000000aa'), 1,
  'el link sigue ahí');
select lives_ok(
  $$ select public.mcp_delete_link('11111111-1111-4111-8111-111111111111',
       'c1000000-0000-4000-8000-0000000000aa', 2, 'Mi video nuevo') $$,
  'con el título exacto, borra');
select throws_ok(
  $$ select public.mcp_delete_link('11111111-1111-4111-8111-111111111111',
       'c1000000-0000-4000-8000-0000000000aa', 2, 'Mi video nuevo') $$,
  'PL404', null, 'borrar otra vez dice que no existe');

-- Secciones y orden.
select is(
  (public.mcp_create_section('11111111-1111-4111-8111-111111111111', 'c5000000-0000-4000-8000-000000000001',
     'Proyectos', true, true)).title,
  'Proyectos', 'crea una sección');
select lives_ok(
  $$ select public.mcp_move_links('11111111-1111-4111-8111-111111111111', 'c5000000-0000-4000-8000-000000000001',
       array['c1000000-0000-4000-8000-000000000002'::uuid],
       array[(select version from public.links where id = 'c1000000-0000-4000-8000-000000000002')]) $$,
  'mueve un link a la sección (la misma RPC del panel)');
select is(
  (select section_id from public.links where id = 'c1000000-0000-4000-8000-000000000002'),
  'c5000000-0000-4000-8000-000000000001'::uuid, 'el link quedó en la sección');
select throws_ok(
  $$ select public.mcp_reorder_sections('11111111-1111-4111-8111-111111111111', '{}', '{}') $$,
  'PL400', null, 'reordenar exige el orden completo, igual que en el panel');
select lives_ok(
  $$ select public.mcp_delete_section('11111111-1111-4111-8111-111111111111',
       'c5000000-0000-4000-8000-000000000001', 1, 'Proyectos') $$,
  'borra la sección con el título exacto');
select is(
  (select section_id from public.links where id = 'c1000000-0000-4000-8000-000000000002'), null,
  'sus links pasan a "Sin sección"');

-- Medios y página.
select is(
  (public.mcp_set_link_media('c1000000-0000-4000-8000-000000000001', '{"watch_live": true}')).watch_live,
  true, 'activa "Transmito en este canal"');
select throws_ok(
  $$ select public.mcp_set_link_media('c1000000-0000-4000-8000-000000000002', '{"watch_live": true}') $$,
  'PL400', null, 'un link genérico no se vigila (el mismo trigger)');
select is(
  (public.mcp_update_page('11111111-1111-4111-8111-111111111111', '{"bio": "Hola desde Claude"}')).bio,
  'Hola desde Claude', 'cambia la bio');
select throws_ok(
  $$ select public.mcp_update_page('11111111-1111-4111-8111-111111111111', '{"avatar_path": null}') $$,
  'PL400', null, 'el avatar no se cambia por MCP');

-- Lo que es solo del panel.
select throws_ok($$ select * from public.admin_list_users() $$, '42501', null,
  'un owner por MCP no usa las funciones de owner');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', '11111111-1111-4111-8111-111111111111/00000000-0000-4000-8000-000000000000.webp') $$,
  '42501', null, 'por MCP no se sube un avatar');

-- ── Desde el panel ───────────────────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select is(public.mcp_revoke_grant('e0000000-0000-4000-8000-00000000000e'), true, 'revoca una conexión');
select lives_ok(
  $$ select public.mcp_save_grant('e0000000-0000-4000-8000-00000000000e', 'Claude', 'Claude.AI', false) $$,
  'una autorización nueva la reactiva, con el permiso elegido');

reset role;
select results_eq(
  $$ select can_write, revoked_at is null, redirect_host, last_used_at is not null from public.mcp_grants
     where client_id = 'e0000000-0000-4000-8000-00000000000e' $$,
  $$ values (false, true, 'claude.ai', true) $$,
  'la conexión quedó activa, de solo lectura y con su último uso');
select results_eq(
  $$ select tool, count(*)::int from private.mcp_audit_log
     where client_id = 'e0000000-0000-4000-8000-00000000000e' group by tool order by tool $$,
  $$ values ('create_link', 1), ('create_section', 1), ('delete_link', 1), ('delete_section', 1),
            ('move_links', 1), ('set_link_media', 1), ('update_link', 1), ('update_page', 1) $$,
  'cada escritura queda en la auditoría, una vez');

select * from finish();
rollback;
