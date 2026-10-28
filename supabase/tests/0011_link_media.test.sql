-- Configuración de medios por link: solo el dueño la ve y la cambia; cada
-- opción, solo en el link que la admite; si el link cambia de proveedor, se
-- borra.
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

create function pg_temp.login(uid uuid)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Seed: owner 1111… (/juedsay), miembro 2222… (/miembro-demo).
insert into public.links (id, owner_id, page_id, title, url, provider, provider_handle) values
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-111111111111', 'Canal', 'https://www.youtube.com/@canal', 'youtube', '@canal'),
  ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-111111111111', 'Twitch', 'https://www.twitch.tv/canal', 'twitch', 'canal'),
  ('a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-111111111111', 'Blog', 'https://ejemplo.com', 'generic', null),
  ('a1000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222',
   '22222222-2222-4222-8222-222222222222', 'Ajeno', 'https://www.twitch.tv/ajeno', 'twitch', 'ajeno');

-- ── El dueño configura sus links ────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ insert into public.link_media_settings (link_id, watch_live, featured_mode, pinned_video_id)
     values ('a1000000-0000-4000-8000-000000000001', true, 'pinned', 'dQw4w9WgXcQ') $$,
  'el dueño vigila su canal de YouTube y fija un video');
select is(
  (select owner_id from public.link_media_settings where link_id = 'a1000000-0000-4000-8000-000000000001'),
  '11111111-1111-4111-8111-111111111111'::uuid, 'el dueño sale del link');
select lives_ok(
  $$ insert into public.link_media_settings (link_id, watch_live, featured_mode, pinned_video_id)
     values ('a1000000-0000-4000-8000-000000000001', true, 'latest_short', 'dQw4w9WgXcQ')
     on conflict (link_id) do update
     set watch_live = excluded.watch_live, featured_mode = excluded.featured_mode,
         pinned_video_id = excluded.pinned_video_id $$,
  'repetir el guardado (upsert) actualiza la misma fila');
select results_eq(
  $$ select watch_live, featured_mode, pinned_video_id from public.link_media_settings
     where link_id = 'a1000000-0000-4000-8000-000000000001' $$,
  $$ values (true, 'latest_short', null::text) $$,
  'sin "Fijado", no queda un video fijado');
select lives_ok(
  $$ insert into public.link_media_settings (link_id, watch_live)
     values ('a1000000-0000-4000-8000-000000000002', true) $$,
  'se vigila un canal de Twitch');

select throws_ok(
  $$ insert into public.link_media_settings (link_id, watch_live)
     values ('a1000000-0000-4000-8000-000000000003', true) $$,
  'PL400', null, 'un link genérico no se vigila');
select throws_ok(
  $$ update public.link_media_settings set featured_mode = 'latest_stream'
     where link_id = 'a1000000-0000-4000-8000-000000000002' $$,
  'PL400', null, 'el contenido destacado es solo de YouTube');
select throws_ok(
  $$ update public.link_media_settings set featured_mode = 'pinned', pinned_video_id = null
     where link_id = 'a1000000-0000-4000-8000-000000000001' $$,
  '23514', null, '"Fijado" pide un video');
select throws_ok(
  $$ update public.link_media_settings set featured_mode = 'pinned', pinned_video_id = 'x/../y'
     where link_id = 'a1000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'el video fijado es un ID de 11 caracteres');
select throws_ok(
  $$ update public.link_media_settings set owner_id = '22222222-2222-4222-8222-222222222222' $$,
  '42501', null, 'nadie cambia el dueño');
select throws_ok(
  $$ update public.link_media_settings set link_id = 'a1000000-0000-4000-8000-000000000004'
     where link_id = 'a1000000-0000-4000-8000-000000000002' $$,
  '42501', null, 'ni pasa la configuración al link de otro');
reset role;

-- ── Nadie más la ve ni la cambia ────────────────────────────────────────────
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select is((select count(*)::int from public.link_media_settings), 0,
  'otro usuario no ve la configuración ajena');
select throws_ok(
  $$ insert into public.link_media_settings (link_id, watch_live)
     values ('a1000000-0000-4000-8000-000000000003', false) $$,
  '42501', null, 'ni configura un link ajeno');
update public.link_media_settings set watch_live = false;
reset role;
select is(
  (select watch_live from public.link_media_settings where link_id = 'a1000000-0000-4000-8000-000000000002'),
  true, 'ni la cambia');

select set_config('role', 'anon', true);
select throws_ok($$ select * from public.link_media_settings $$,
  '42501', null, 'anon no la lee');
reset role;

-- ── Un cliente MCP no escribe directo ───────────────────────────────────────
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', jsonb_build_object(
         'sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated',
         'client_id', 'cliente-mcp')::text, true);
update public.link_media_settings set watch_live = false
  where link_id = 'a1000000-0000-4000-8000-000000000002';
reset role;
select is(
  (select watch_live from public.link_media_settings where link_id = 'a1000000-0000-4000-8000-000000000002'),
  true, 'un cliente MCP no cambia la configuración directo');

-- ── Si el link cambia de proveedor o deja de ser un canal, se borra ─────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
update public.links set url = 'https://ejemplo.com/twitch', provider = 'generic', provider_handle = null
  where id = 'a1000000-0000-4000-8000-000000000002';
update public.links set url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', provider_handle = null
  where id = 'a1000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.link_media_settings), 0,
  'un link que cambia de proveedor o deja de ser un canal pierde su configuración');
reset role;

-- ── Borrar el link borra su configuración ───────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
update public.links set url = 'https://www.youtube.com/@canal', provider_handle = '@canal'
  where id = 'a1000000-0000-4000-8000-000000000001';
insert into public.link_media_settings (link_id, watch_live) values ('a1000000-0000-4000-8000-000000000001', true);
delete from public.links where id = 'a1000000-0000-4000-8000-000000000001';
reset role;
select is(
  (select count(*)::int from public.link_media_settings where link_id = 'a1000000-0000-4000-8000-000000000001'),
  0, 'borrar el link borra su configuración');

select * from finish();
rollback;
