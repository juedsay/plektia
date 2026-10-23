-- Páginas (SPEC-pages): límite de 3 por cuenta, RLS, dueño de secciones y links,
-- la última página no se borra y `last_page_id` solo apunta a una página propia.
begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

create function pg_temp.login(uid uuid)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.login_mcp(uid uuid)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           jsonb_build_object('sub', uid, 'role', 'authenticated', 'client_id', 'cliente-mcp')::text, true);
$$;

create function pg_temp.as_anon()
returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '', true);
$$;

-- En el seed, la primera página de cada usuario tiene el id del usuario.
-- Dueño 1111…; otro usuario 2222…
-- Punto de partida propio: el dueño con una sola página (el seed le da dos).
delete from public.pages
where owner_id = '11111111-1111-4111-8111-111111111111' and id <> '11111111-1111-4111-8111-111111111111';

-- ── Alta y límite ────────────────────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ insert into public.pages (handle, display_name) values ('juedsay-pro', 'Juedsay Pro') $$,
  'el dueño crea una segunda página');
select is((select owner_id from public.pages where handle = 'juedsay-pro'),
  '11111111-1111-4111-8111-111111111111'::uuid, 'la página nueva es de quien la crea');
select lives_ok(
  $$ insert into public.pages (handle, display_name) values ('juedsay-games', 'Juedsay Games') $$,
  'el dueño crea una tercera página');
select throws_ok(
  $$ insert into public.pages (handle, display_name) values ('juedsay-cuarta', 'Cuarta') $$,
  'PL429', null, 'límite: la cuarta página se rechaza');
select is((select count(*)::int from public.pages where owner_id = auth.uid()), 3,
  'límite: la cuarta no se creó');
select throws_ok(
  $$ insert into public.pages (owner_id, handle, display_name)
     values ('22222222-2222-4222-8222-222222222222', 'colada', 'Colada') $$,
  '42501', null, 'nadie crea una página a nombre de otro');
reset role;

select pg_temp.login('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$ insert into public.pages (handle, display_name) values ('juedsay-pro', 'Copia') $$,
  '23505', null, 'el handle de una página es único');
select throws_ok(
  $$ insert into public.pages (handle, display_name) values ('contact', 'Reservado') $$,
  '23514', null, 'una página no puede usar un handle reservado');
reset role;

select pg_temp.login_mcp('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$ insert into public.pages (handle, display_name) values ('desde-mcp', 'MCP') $$,
  '42501', null, 'un cliente MCP no crea páginas');
reset role;

-- ── Lectura (RLS) ────────────────────────────────────────────────────────────
select pg_temp.as_anon();
select is((select count(*)::int from public.pages where owner_id = '11111111-1111-4111-8111-111111111111'), 3,
  'anon ve las páginas de una cuenta activa');
reset role;

-- ── Edición ──────────────────────────────────────────────────────────────────
select pg_temp.login('22222222-2222-4222-8222-222222222222');
update public.pages set bio = 'pisada' where handle = 'juedsay-pro';
reset role;
select is((select bio from public.pages where handle = 'juedsay-pro'), null,
  'nadie edita la página de otro');

select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ update public.pages set bio = 'QA', show_handle = false where handle = 'juedsay-pro' $$,
  'el dueño edita su página');
select throws_ok(
  $$ update public.pages set handle = 'otro-handle' where handle = 'juedsay-pro' $$,
  '42501', null, 'el handle de una página no se cambia');
select throws_ok(
  $$ update public.pages set owner_id = '22222222-2222-4222-8222-222222222222' where handle = 'juedsay-pro' $$,
  '42501', null, 'el dueño de una página no se cambia');
reset role;

-- ── Secciones y links: siempre en una página propia ──────────────────────────
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$ insert into public.sections (page_id, title)
     values ((select id from public.pages where handle = 'juedsay-pro'), 'Colada') $$,
  'PL404', null, 'nadie crea secciones en la página de otro');
select throws_ok(
  $$ insert into public.links (page_id, title, url)
     values ((select id from public.pages where handle = 'juedsay-pro'), 'Colado', 'https://plektia.app') $$,
  'PL404', null, 'nadie crea links en la página de otro');
reset role;

select pg_temp.login('11111111-1111-4111-8111-111111111111');
insert into public.sections (page_id, title)
values ((select id from public.pages where handle = 'juedsay-pro'), 'Trabajo');
select throws_ok(
  $$ insert into public.links (page_id, section_id, title, url)
     values ('11111111-1111-4111-8111-111111111111', (select id from public.sections where title = 'Trabajo'), 'Cruzado', 'https://plektia.app') $$,
  'PL404', null, 'un link no usa la sección de otra página propia');
select throws_ok(
  $$ update public.links set page_id = (select id from public.pages where handle = 'juedsay-pro')
     where owner_id = auth.uid() $$,
  '42501', null, 'un link no cambia de página');
reset role;

-- ── Última página usada ──────────────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ update public.profiles set last_page_id = (select id from public.pages where handle = 'juedsay-pro')
     where id = auth.uid() $$,
  'el dueño guarda su última página usada');
select throws_ok(
  $$ update public.profiles set last_page_id = '22222222-2222-4222-8222-222222222222'
     where id = auth.uid() $$,
  'PL404', null, 'last_page_id no apunta a una página ajena');
reset role;

-- ── Borrado ──────────────────────────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok($$ delete from public.pages where handle = 'juedsay-pro' $$,
  'el dueño borra una página');
select is((select last_page_id from public.profiles where id = auth.uid()), null,
  'al borrar la última página usada, last_page_id queda vacío');
select is((select count(*)::int from public.sections where title = 'Trabajo'), 0,
  'las secciones se borran con su página');
delete from public.pages where handle = 'juedsay-games';
select throws_ok(
  $$ delete from public.pages where owner_id = auth.uid() $$,
  'PL409', null, 'la única página de una cuenta no se borra');
reset role;

-- Una cuenta dada de baja: su sesión (el JWT dura hasta una hora) no cambia nada.
update public.profiles set disabled = true where id = '22222222-2222-4222-8222-222222222222';
select pg_temp.login('22222222-2222-4222-8222-222222222222');
update public.pages set bio = 'después de la baja' where owner_id = auth.uid();
delete from public.pages where owner_id = auth.uid();
select throws_ok(
  $$ insert into public.pages (handle, display_name) values ('tras-la-baja', 'Baja') $$,
  '42501', null, 'una cuenta dada de baja no crea páginas');
reset role;
select isnt((select bio from public.pages where id = '22222222-2222-4222-8222-222222222222'),
  'después de la baja', 'una cuenta dada de baja no edita sus páginas');
select is((select count(*)::int from public.pages where owner_id = '22222222-2222-4222-8222-222222222222'), 1,
  'una cuenta dada de baja no borra sus páginas');

-- Si se borra la cuenta entera, sus páginas se van con ella.
select lives_ok(
  $$ delete from auth.users where id = '22222222-2222-4222-8222-222222222222' $$,
  'borrar la cuenta borra también su única página');
select is((select count(*)::int from public.pages where owner_id = '22222222-2222-4222-8222-222222222222'), 0,
  'no quedan páginas de una cuenta borrada');

select * from finish();
rollback;
