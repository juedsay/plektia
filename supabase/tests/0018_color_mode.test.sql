-- Modo claro, oscuro y automático (tarea 34, SPEC-appearance): el de cada página
-- (público, en la vista) y el del panel (solo del dueño).
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

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

-- ── Página ───────────────────────────────────────────────────────────────────
select is(
  (select count(*)::int from public.pages where color_mode <> 'auto'), 0,
  'todas las páginas existentes quedaron en automático');

select pg_temp.as_anon();
select is(
  (select color_mode from public.public_page_v where handle = 'juedsay'), 'auto'::public.color_mode,
  'la vista pública expone el modo');

select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ update public.pages set color_mode = 'light' where id = '11111111-1111-4111-8111-111111111111' $$,
  'el dueño fija el modo claro');
select is(
  (select color_mode from public.pages where id = '11111111-1111-4111-8111-111111111111'),
  'light'::public.color_mode, 'quedó en claro');
select throws_ok(
  $$ update public.pages set color_mode = 'sepia' where id = '11111111-1111-4111-8111-111111111111' $$,
  '22P02', null, 'un modo que no existe se rechaza');
select is_empty(
  $$ update public.pages set color_mode = 'dark' where id = '22222222-2222-4222-8222-222222222222' returning id $$,
  'no cambia el modo de una página ajena');

select pg_temp.login('11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-00000000000e');
select is_empty(
  $$ update public.pages set color_mode = 'dark' where id = '11111111-1111-4111-8111-111111111111' returning id $$,
  'un cliente MCP no cambia el modo de la página');

reset role;
insert into public.pages (handle, display_name, owner_id)
values ('modo-nuevo', 'Nueva', '11111111-1111-4111-8111-111111111111');
select is(
  (select color_mode from public.pages where handle = 'modo-nuevo'), 'auto'::public.color_mode,
  'una página nueva empieza en automático');

-- ── Panel ────────────────────────────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ insert into public.account_preferences (panel_mode) values ('light') $$,
  'el dueño guarda el modo de su panel');
select lives_ok(
  $$ insert into public.account_preferences (panel_mode) values ('dark')
     on conflict (user_id) do update set panel_mode = excluded.panel_mode $$,
  'guardarlo de nuevo actualiza la misma fila');
select results_eq(
  $$ select user_id, panel_mode from public.account_preferences $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'dark'::public.color_mode) $$,
  've solo la suya, con el último valor');
select throws_ok(
  $$ insert into public.account_preferences (user_id, panel_mode)
     values ('22222222-2222-4222-8222-222222222222', 'light') $$,
  '42501', null, 'no guarda preferencias a nombre de otro');

select pg_temp.login('22222222-2222-4222-8222-222222222222');
select is_empty($$ select 1 from public.account_preferences $$, 'otro usuario no ve las ajenas');

select pg_temp.as_anon();
select throws_ok(
  $$ select panel_mode from public.account_preferences $$,
  '42501', null, 'el público no lee preferencias de nadie');

select * from finish();
rollback;
