-- Contenido destacado: solo el refresco (service_role) escribe, por funciones
-- `ingest_*`; nadie más lee ni escribe las tablas. Lock, cuota y detección de
-- cambios para purgar la caché.
begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

create function pg_temp.login(uid uuid)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Seed: owner 1111… (/juedsay, con un link de YouTube @juedsay).
insert into public.links (id, owner_id, page_id, title, url, provider, provider_handle) values
  ('b1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-111111111111', 'Canal', 'https://www.youtube.com/@canal-tap', 'youtube', '@canal-tap'),
  ('b1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-111111111111', 'Nada', 'https://www.youtube.com/@nada-tap', 'youtube', '@nada-tap'),
  ('b1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-111111111111', 'Oculto', 'https://www.youtube.com/@oculto-tap', 'youtube', '@oculto-tap');
update public.links set visible = false where id = 'b1000000-0000-4000-8000-000000000003';
-- Un link visible dentro de una sección oculta tampoco se ve en la página.
insert into public.sections (id, owner_id, page_id, title, visible) values
  ('b2000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-111111111111', 'Sección oculta', false);
insert into public.links (id, owner_id, page_id, section_id, title, url, provider, provider_handle) values
  ('b1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-111111111111', 'b2000000-0000-4000-8000-000000000001', 'En sección oculta',
   'https://www.youtube.com/@seccion-tap', 'youtube', '@seccion-tap');
insert into public.link_media_settings (link_id, featured_mode)
values ('b1000000-0000-4000-8000-000000000002', 'none');

-- ── Nadie más que el refresco ───────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select throws_ok($$ select * from public.featured_content $$, '42501', null,
  'el dueño no lee la tabla directo');
select throws_ok(
  $$ insert into public.featured_content (link_id, video_id, kind, title, published_at)
     values ('b1000000-0000-4000-8000-000000000001', 'dQw4w9WgXcQ', 'video', 'Falso', now()) $$,
  '42501', null, 'ni falsifica lo destacado');
select throws_ok($$ select * from public.provider_channels $$, '42501', null,
  'ni lee los canales');
select throws_ok($$ select public.ingest_try_lock('featured', 60) $$, '42501', null,
  'ni toma el lock del cron');
select throws_ok($$ select public.ingest_consume_quota('youtube', 1, 8000) $$, '42501', null,
  'ni gasta cuota');
select throws_ok(
  $$ select public.ingest_featured('b1000000-0000-4000-8000-000000000001', 'dQw4w9WgXcQ',
       'video', 'Falso', now(), null) $$,
  '42501', null, 'ni llama a la ingesta');
reset role;

select set_config('role', 'anon', true);
select throws_ok($$ select * from public.ingest_featured_targets() $$, '42501', null,
  'anon tampoco');
reset role;

-- ── El refresco (service_role) ──────────────────────────────────────────────
set local role service_role;

select is(public.ingest_try_lock('featured', 600), true, 'toma el lock libre');
select is(public.ingest_try_lock('featured', 600), false, 'no lo toma dos veces');
select public.ingest_release_lock('featured');
select is(public.ingest_try_lock('featured', 600), true, 'liberado, se vuelve a tomar');

select is(public.ingest_consume_quota('youtube', 5, 8), true, 'gasta cuota dentro del límite');
select is(public.ingest_consume_quota('youtube', 4, 8), false, 'no pasa el límite diario');
select is(public.ingest_consume_quota('youtube', 3, 8), true, 'lo que entra, entra');

select results_eq(
  $$ select link_id, handle, featured_mode, channel_id from public.ingest_featured_targets()
     where handle like '%-tap' $$,
  $$ values ('b1000000-0000-4000-8000-000000000001'::uuid, '@canal-tap', 'latest_video', null::text) $$,
  'solo links visibles que destacan algo, con "Último video" por defecto');
select is(
  (select count(*)::int from public.ingest_featured_targets() where handle = '@seccion-tap'), 0,
  'un link en una sección oculta no gasta cuota');

select public.ingest_channel('youtube', '@canal-tap', 'UCabcdefghijklmnopqrstuv', null);
select is(
  (select channel_id from public.ingest_featured_targets() where handle = '@canal-tap'),
  'UCabcdefghijklmnopqrstuv', 'el canal resuelto queda guardado');
select throws_ok(
  $$ select public.ingest_channel('youtube', '@otro', 'no-es-un-id', null) $$,
  '23514', null, 'un ID de canal mal formado no se guarda');

select is(
  public.ingest_featured('b1000000-0000-4000-8000-000000000001', 'dQw4w9WgXcQ', 'video',
    'Primer video', '2026-10-20T10:00:00Z', 300),
  'juedsay', 'algo nuevo devuelve la página a purgar');
select is(
  public.ingest_featured('b1000000-0000-4000-8000-000000000001', 'dQw4w9WgXcQ', 'video',
    'Primer video', '2026-10-20T10:00:00Z', 300),
  null, 'lo mismo otra vez no purga nada');
select throws_ok(
  $$ select public.ingest_featured('b1000000-0000-4000-8000-000000000001', 'x/../y', 'video',
       'Malo', now(), null) $$,
  '23514', null, 'un video mal formado no se guarda');
select throws_ok(
  $$ select public.ingest_featured('b1000000-0000-4000-8000-000000000001', 'dQw4w9WgXcQ', 'video',
       E'Título\ncon salto', now(), null) $$,
  '23514', null, 'un título con caracteres de control tampoco');

select is(public.ingest_featured_clear('b1000000-0000-4000-8000-000000000001'), 'juedsay',
  'borrar lo destacado devuelve la página');
select is(public.ingest_featured_clear('b1000000-0000-4000-8000-000000000001'), null,
  'borrar otra vez no devuelve nada');

reset role;

select * from finish();
rollback;
