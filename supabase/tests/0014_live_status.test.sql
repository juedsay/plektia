-- Estado en vivo: solo el refresco (service_role) lo escribe; solo se vigilan
-- los canales con "Transmito en este canal"; y solo un cambio visible pide
-- purgar la página.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

create function pg_temp.login(uid uuid)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Seed: /juedsay (owner 1111…) tiene Twitch `juedsay` y YouTube `@juedsay`.
-- ── Nadie más que el refresco ───────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select throws_ok($$ select * from public.channel_status $$, '42501', null,
  'el dueño no lee el estado directo');
select throws_ok(
  $$ select public.ingest_live_status('twitch', 'juedsay', true, 'Falso', now(),
       'https://www.twitch.tv/juedsay') $$,
  '42501', null, 'ni falsifica un "En vivo"');
select throws_ok($$ select * from public.ingest_live_targets() $$, '42501', null,
  'ni lista los canales vigilados');

-- El dueño activa "Transmito en este canal" en su Twitch.
insert into public.link_media_settings (link_id, watch_live)
select id, true from public.links
where provider_handle = 'juedsay' and page_id = '11111111-1111-4111-8111-111111111111';
reset role;

-- ── El refresco (service_role) ──────────────────────────────────────────────
set local role service_role;

select results_eq(
  $$ select provider, handle from public.ingest_live_targets() $$,
  $$ values ('twitch', 'juedsay') $$,
  'solo se vigila lo que el dueño marcó (el YouTube no)');

select is(
  public.ingest_live_status('twitch', 'juedsay', true, 'Programando en vivo',
    '2026-10-28T20:00:00Z', 'https://www.twitch.tv/juedsay'),
  array['juedsay'], 'empezar un directo pide purgar la página');
select is(
  public.ingest_live_status('twitch', 'juedsay', true, 'Programando en vivo',
    '2026-10-28T20:00:00Z', 'https://www.twitch.tv/juedsay'),
  array[]::text[], 'lo mismo otra vez no purga nada');
select ok(
  (select checked_at > now() - interval '1 minute' from public.channel_status s
   join public.provider_channels c on c.id = s.channel_id where c.handle = 'juedsay'),
  'pero deja anotada la revisión (regla de los 25 minutos)');
select is(
  public.ingest_live_status('twitch', 'juedsay', false, null, null, null),
  array['juedsay'], 'terminar el directo también purga');
select results_eq(
  $$ select is_live, live_title, live_url from public.channel_status s
     join public.provider_channels c on c.id = s.channel_id where c.handle = 'juedsay' $$,
  $$ values (false, null::text, null::text) $$,
  'offline no guarda título ni URL');

select throws_ok(
  $$ select public.ingest_live_status('twitch', 'juedsay', true, 'Malo', now(),
       'https://evil.com/phishing') $$,
  '23514', null, 'el aviso solo lleva a Twitch o YouTube');
select throws_ok(
  $$ select public.ingest_live_status('twitch', 'juedsay', true, E'Título\ncon salto', now(),
       'https://www.twitch.tv/juedsay') $$,
  '23514', null, 'un título con caracteres de control no se guarda');
reset role;

-- Una cuenta dada de baja deja de vigilarse.
update public.profiles set disabled = true where id = '11111111-1111-4111-8111-111111111111';
set local role service_role;
select is((select count(*)::int from public.ingest_live_targets()), 0,
  'una cuenta dada de baja no gasta revisiones');
reset role;

select * from finish();
rollback;
