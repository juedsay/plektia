-- Huecos de revocación (auditoría de seguridad, run 1): una conexión MCP
-- revocada no lee lo privado del dueño directo en la tabla, y una cuenta dada
-- de baja no escribe en el bucket `link-previews`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

create function pg_temp.login(uid uuid, client_id text default null)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', 'authenticated', 'client_id', client_id))::text,
           true);
$$;

-- Dueño 1111…: una conexión activa (L, solo lectura) y una revocada (R).
insert into public.mcp_grants (client_id, user_id, client_name, redirect_host, can_write, revoked_at) values
  ('10000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', 'Lector', 'lector.example', false, null),
  ('a0000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', 'Vieja', 'vieja.example', true, now());

-- Un link oculto, sus números y una preferencia: lo privado del dueño.
insert into public.links (id, owner_id, page_id, title, url, visible) values
  ('c2000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-111111111111', 'Borrador', 'https://ejemplo.com/borrador', false);
insert into public.stats_daily (page_id, day, views) values
  ('11111111-1111-4111-8111-111111111111', current_date, 7);
insert into public.account_preferences (user_id, panel_mode) values
  ('11111111-1111-4111-8111-111111111111', 'dark')
  on conflict (user_id) do update set panel_mode = excluded.panel_mode;

-- ── Lecturas del dueño ───────────────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select is(
  (select count(*)::int from public.links where id = 'c2000000-0000-4000-8000-000000000001'),
  1, 'el panel ve el link oculto');
select isnt_empty($$ select 1 from public.stats_daily $$, 'el panel ve sus estadísticas');

select pg_temp.login('11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-00000000000a');
select is(
  (select count(*)::int from public.links where id = 'c2000000-0000-4000-8000-000000000001'),
  1, 'una conexión activa ve el link oculto');
select isnt_empty($$ select 1 from public.stats_daily $$, 'una conexión activa ve las estadísticas');

select pg_temp.login('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-00000000000a');
select is(
  (select count(*)::int from public.links where id = 'c2000000-0000-4000-8000-000000000001'),
  0, 'una conexión revocada no ve el link oculto');
select is_empty($$ select 1 from public.stats_daily $$, 'ni las estadísticas');
select is_empty($$ select 1 from public.account_preferences $$, 'ni las preferencias');
select isnt_empty(
  $$ select 1 from public.links where visible and owner_id = '11111111-1111-4111-8111-111111111111' $$,
  'lo público lo sigue viendo, como cualquiera');

select pg_temp.login('11111111-1111-4111-8111-111111111111', 'no-es-un-uuid');
select is(public.owner_read_allowed(), false, 'un client_id malformado no lee como dueño');
reset role;

-- ── link-previews: una cuenta dada de baja no sube ───────────────────────────
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('link-previews', '22222222-2222-4222-8222-222222222222/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.webp') $$,
  'una cuenta activa sube su vista previa');
reset role;

update public.profiles set disabled = true where id = '22222222-2222-4222-8222-222222222222';
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('link-previews', '22222222-2222-4222-8222-222222222222/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4f.webp') $$,
  '42501', null, 'una cuenta dada de baja no sube vistas previas');
reset role;

-- Que tampoco borre lo prueba la política (mismo predicado): Storage no deja
-- borrar filas por SQL, solo por su API.

select * from finish();
rollback;
