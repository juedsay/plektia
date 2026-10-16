-- Links: RLS con anon, dueño, otro usuario y service_role; triggers; checks de la
-- base (tabla de amenazas de SPEC-links).
begin;
create extension if not exists pgtap with schema extensions;

select plan(41);

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

-- Dueño (1111…) y otro usuario (2222…) vienen del seed.
-- Secciones: S1 visible y S2 oculta del dueño; M1 visible del otro.
insert into public.sections (id, owner_id, title, visible) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Redes', true),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Borradores', false),
  ('aaaaaaaa-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'Lo mío', true);
-- Links: L1 visible y L2 oculto en S1; L3 visible en S2 (oculta); L4 sin sección; ML1 del otro.
insert into public.links (id, owner_id, section_id, title, url, visible) values
  ('bbbbbbbb-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'YouTube', 'https://youtube.com/@juedsay', true),
  ('bbbbbbbb-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'Secreto', 'https://plektia.app/secreto', false),
  ('bbbbbbbb-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002', 'En borrador', 'https://plektia.app/borrador', true),
  ('bbbbbbbb-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', null, 'Mail', 'mailto:hola@plektia.app', true),
  ('bbbbbbbb-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', null, 'Lo suyo', 'https://plektia.app/otro', true);

-- ── Triggers de alta ─────────────────────────────────────────────────────────
select results_eq(
  $$ select position from public.sections where owner_id = '11111111-1111-4111-8111-111111111111' order by position $$,
  $$ values (0), (1) $$,
  'alta: las secciones se ubican al final, sin huecos');
select results_eq(
  $$ select title, position from public.links where section_id = 'aaaaaaaa-0000-4000-8000-000000000001' order by position $$,
  $$ values ('YouTube', 0), ('Secreto', 1) $$,
  'alta: cada link va al final de su grupo');
select is((select position from public.links where id = 'bbbbbbbb-0000-4000-8000-000000000004'), 0,
  'alta: "Sin sección" es un grupo propio de cada dueño');

-- ── Lectura (RLS) ────────────────────────────────────────────────────────────
select pg_temp.as_anon();
select results_eq($$ select title from public.sections order by title $$,
  $$ values ('Lo mío'), ('Redes') $$, 'anon: ve solo las secciones visibles');
select results_eq($$ select title from public.links order by title $$,
  $$ values ('Lo suyo'), ('Mail'), ('YouTube') $$,
  'anon: no ve links ocultos ni links visibles dentro de una sección oculta');
reset role;

select pg_temp.login('22222222-2222-4222-8222-222222222222');
select results_eq($$ select title from public.links order by title $$,
  $$ values ('Lo suyo'), ('Mail'), ('YouTube') $$, 'otro usuario: ve lo público del dueño y lo suyo');
select is((select count(*)::int from public.sections where title = 'Borradores'), 0,
  'otro usuario: no ve la sección oculta del dueño');
reset role;

select pg_temp.login('11111111-1111-4111-8111-111111111111');
select is((select count(*)::int from public.links where owner_id = auth.uid()), 4,
  'dueño: ve todos sus links, también los ocultos');
select is((select count(*)::int from public.sections where owner_id = auth.uid()), 2,
  'dueño: ve todas sus secciones, también las ocultas');
reset role;

set local role service_role;
select is((select count(*)::int from public.links), 5, 'service_role: ve todo (saltea RLS)');
reset role;

-- ── Escritura (RLS, privilegios por columna, trigger de sección) ─────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ insert into public.links (section_id, title, url) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Twitch', 'https://twitch.tv/juedsay') $$,
  'dueño: crea un link en su sección');
select is((select position from public.links where title = 'Twitch'), 2, 'dueño: el link nuevo queda al final');
select throws_ok(
  $$ insert into public.links (owner_id, title, url) values ('22222222-2222-4222-8222-222222222222', 'Ajeno', 'https://plektia.app') $$,
  '42501', null, 'dueño: no crea links a nombre de otro');
select throws_ok(
  $$ insert into public.links (section_id, title, url) values ('aaaaaaaa-0000-4000-8000-000000000003', 'Colado', 'https://plektia.app') $$,
  'PL404', null, 'dueño: no mete un link en la sección de otro');
select throws_ok(
  $$ update public.links set section_id = 'aaaaaaaa-0000-4000-8000-000000000003' where id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'PL404', null, 'dueño: no mueve su link a la sección de otro');
update public.links set title = 'Hackeado' where id = 'bbbbbbbb-0000-4000-8000-000000000005';
delete from public.links where id = 'bbbbbbbb-0000-4000-8000-000000000005';
update public.sections set title = 'Hackeada' where id = 'aaaaaaaa-0000-4000-8000-000000000003';
select throws_ok(
  $$ update public.links set owner_id = '22222222-2222-4222-8222-222222222222' where id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  '42501', null, 'dueño: no le pasa un link a otro (owner_id no se puede cambiar)');
select throws_ok(
  $$ update public.links set version = 99 where id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  '42501', null, 'dueño: no fija la versión a mano');
update public.links set title = 'YouTube (canal)' where id = 'bbbbbbbb-0000-4000-8000-000000000001';
reset role;
select results_eq(
  $$ select title from public.links where id = 'bbbbbbbb-0000-4000-8000-000000000005' $$,
  $$ values ('Lo suyo') $$, 'dueño: no edita ni borra el link de otro');
select is((select title from public.sections where id = 'aaaaaaaa-0000-4000-8000-000000000003'), 'Lo mío',
  'dueño: no edita la sección de otro');
select is((select version from public.links where id = 'bbbbbbbb-0000-4000-8000-000000000001'), 2,
  'cada cambio incrementa la versión (concurrencia optimista)');

select pg_temp.as_anon();
select throws_ok($$ insert into public.links (title, url) values ('x', 'https://plektia.app') $$,
  '42501', null, 'anon: no crea links');
select throws_ok($$ insert into public.sections (title) values ('x') $$,
  '42501', null, 'anon: no crea secciones');
reset role;

-- Un token de cliente MCP no escribe directo en las tablas.
select pg_temp.login('11111111-1111-4111-8111-111111111111', 'cliente-mcp');
update public.links set title = 'Desde MCP' where id = 'bbbbbbbb-0000-4000-8000-000000000004';
select throws_ok($$ insert into public.links (title, url) values ('MCP', 'https://plektia.app') $$,
  '42501', null, 'MCP: no crea links por la API directa');
reset role;
select is((select title from public.links where id = 'bbbbbbbb-0000-4000-8000-000000000004'), 'Mail',
  'MCP: no edita links por la API directa');

-- Un usuario dado de baja no escribe y su contenido deja de ser público.
insert into private.allowed_emails (email, handle) values ('baja@plektia.test', 'usuario-baja');
insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'baja@plektia.test');
insert into public.links (owner_id, title, url) values ('33333333-3333-4333-8333-333333333333', 'De baja', 'https://plektia.app/baja');
update public.profiles set disabled = true where id = '33333333-3333-4333-8333-333333333333';
select pg_temp.login('33333333-3333-4333-8333-333333333333');
select throws_ok($$ insert into public.links (title, url) values ('Sigo', 'https://plektia.app') $$,
  '42501', null, 'dado de baja: no crea links');
reset role;
select pg_temp.as_anon();
select is((select count(*)::int from public.links where title = 'De baja'), 0,
  'dado de baja: sus links dejan de ser públicos');
reset role;

-- ── Checks de la base (por si alguien escribe sin la app) ────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select throws_ok($$ insert into public.links (title, url) values ('XSS', 'javascript:alert(1)') $$,
  '23514', null, 'check: rechaza javascript:');
select throws_ok($$ insert into public.links (title, url) values ('XSS', 'JAVASCRIPT:alert(1)') $$,
  '23514', null, 'check: rechaza javascript: en mayúsculas');
select throws_ok($$ insert into public.links (title, url) values ('XSS', 'data:text/html,x') $$,
  '23514', null, 'check: rechaza data:');
select throws_ok($$ insert into public.links (title, url) values ('Phishing', 'https://google.com@evil.com') $$,
  '23514', null, 'check: rechaza credenciales embebidas');
select throws_ok($$ insert into public.links (title, url) values ('Inseguro', 'http://plektia.app') $$,
  '23514', null, 'check: rechaza http sin cifrar');
select throws_ok($$ insert into public.links (title, url) values ('Tab', E'https://plektia.app/a\tb') $$,
  '23514', null, 'check: rechaza caracteres de control en la URL');
select throws_ok($$ insert into public.links (title, url) values (repeat('a', 81), 'https://plektia.app') $$,
  '23514', null, 'check: título de más de 80');
select throws_ok($$ insert into public.links (title, url) values (E'Mi\ncanal', 'https://plektia.app') $$,
  '23514', null, 'check: título con salto de línea');
select throws_ok($$ insert into public.links (title, url, tags) values ('x', 'https://plektia.app', '{a,b,c,d,e,f}') $$,
  '23514', null, 'check: más de 5 etiquetas');
select throws_ok($$ insert into public.links (title, url, tags) values ('x', 'https://plektia.app', '{"En Vivo"}') $$,
  '23514', null, 'check: etiqueta con formato inválido');
select lives_ok($$ insert into public.links (title, url, tags) values ('Ok', 'mailto:x@plektia.app', '{gaming,en-vivo}') $$,
  'check: acepta mailto y etiquetas válidas');
reset role;

-- ── Límites ──────────────────────────────────────────────────────────────────
insert into public.links (owner_id, title, url)
select '22222222-2222-4222-8222-222222222222', 'L' || g, 'https://plektia.app/' || g
from generate_series(2, 200) g;
select throws_ok(
  $$ insert into public.links (owner_id, title, url) values ('22222222-2222-4222-8222-222222222222', 'El 201', 'https://plektia.app') $$,
  'PL429', null, 'límite: el link 201 se rechaza');
insert into public.sections (owner_id, title)
select '22222222-2222-4222-8222-222222222222', 'S' || g from generate_series(2, 30) g;
select throws_ok(
  $$ insert into public.sections (owner_id, title) values ('22222222-2222-4222-8222-222222222222', 'La 31') $$,
  'PL429', null, 'límite: la sección 31 se rechaza');

-- ── Borrar una sección ───────────────────────────────────────────────────────
-- S1 tiene (en orden) YouTube (canal), Secreto, Twitch; "Sin sección" tiene Mail y Ok.
select pg_temp.login('11111111-1111-4111-8111-111111111111');
delete from public.sections where id = 'aaaaaaaa-0000-4000-8000-000000000001';
reset role;
select results_eq(
  $$ select title, position from public.links
     where owner_id = '11111111-1111-4111-8111-111111111111' and section_id is null order by position $$,
  $$ values ('Mail', 0), ('Ok', 1), ('YouTube (canal)', 2), ('Secreto', 3), ('Twitch', 4) $$,
  'borrar una sección: sus links pasan al final de "Sin sección", en su orden');
select lives_ok('set constraints all immediate', 'después de todo, ninguna posición repetida');

select * from finish();
rollback;
