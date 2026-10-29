-- Estadísticas: solo `ingest_event` escribe (service_role), solo el dueño lee;
-- lo del propio dueño, lo oculto y lo inválido no cuenta; retención de 400 días.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

create function pg_temp.login(uid uuid)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Seed: owner 1111… (/juedsay, Twitch visible), miembro 2222… (/miembro-demo).
select set_config('test.twitch', (
  select id::text from public.links
  where provider_handle = 'juedsay' and page_id = '11111111-1111-4111-8111-111111111111'
), false);
create function pg_temp.views_today()
returns integer language sql as $$
  select coalesce((select views from public.stats_daily
    where page_id = '11111111-1111-4111-8111-111111111111'
      and day = (now() at time zone 'UTC')::date), 0);
$$;

-- ── Nadie escribe directo ───────────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$ insert into public.stats_daily (page_id, day, views)
     values ('11111111-1111-4111-8111-111111111111', current_date, 1000) $$,
  '42501', null, 'el dueño no infla sus propios números');
select throws_ok(
  $$ select public.ingest_event('view', 'juedsay', null, 'direct', 'AR', null) $$,
  '42501', null, 'ni llama a la ingesta');
reset role;
select set_config('role', 'anon', true);
select throws_ok(
  $$ select public.ingest_event('view', 'juedsay', null, 'direct', 'AR', null) $$,
  '42501', null, 'un visitante tampoco (va por el endpoint)');
select throws_ok($$ select * from public.stats_daily $$, '42501', null,
  'ni lee las estadísticas');
reset role;

-- ── La ingesta ──────────────────────────────────────────────────────────────
set local role service_role;
select public.ingest_event('view', 'juedsay', null, 'instagram', 'AR', null);
select public.ingest_event('view', 'JuedSay', null, 'direct', 'ES', null);
select is(pg_temp.views_today(), 2, 'cada visita suma (el handle sin importar mayúsculas)');

select public.ingest_event('view', 'juedsay', null, 'direct', 'AR',
  '11111111-1111-4111-8111-111111111111');
select is(pg_temp.views_today(), 2, 'la visita del propio dueño no cuenta');

select public.ingest_event('click', null, current_setting('test.twitch')::uuid, 'instagram', 'AR', null);
select results_eq(
  $$ select clicks from public.link_stats_daily where link_id = current_setting('test.twitch')::uuid $$,
  $$ values (1) $$, 'un clic suma en el link');
select is(
  (select clicks from public.stats_daily where page_id = '11111111-1111-4111-8111-111111111111'
     and day = (now() at time zone 'UTC')::date),
  1, 'y en la página');
select results_eq(
  $$ select dimension, value, views, clicks from public.stats_breakdown_daily
     where page_id = '11111111-1111-4111-8111-111111111111' order by dimension, value $$,
  $$ values ('country', 'AR', 1, 1), ('country', 'ES', 1, 0),
            ('source', 'direct', 1, 0), ('source', 'instagram', 1, 1) $$,
  'países y orígenes por separado');

-- Lo inválido o inexistente se ignora (sin error: el endpoint responde 204 igual).
select public.ingest_event('view', 'juedsay', null, 'https://evil.com/?ref=x', 'AR', null);
select public.ingest_event('view', 'nadie-existe', null, 'direct', 'AR', null);
select public.ingest_event('click', null, gen_random_uuid(), 'direct', 'AR', null);
select public.ingest_event('borrar', 'juedsay', null, 'direct', 'AR', null);
select is(pg_temp.views_today(), 2, 'un origen fuera de la lista, un handle o link inexistente no suman');
select public.ingest_event('view', 'juedsay', null, 'direct', '<script>', null);
select ok(
  exists (select 1 from public.stats_breakdown_daily where dimension = 'country' and value = 'XX')
  and not exists (select 1 from public.stats_breakdown_daily where value like '%<%'),
  'un país mal formado se guarda como XX');
reset role;

-- Un link oculto no cuenta clics.
update public.links set visible = false where id = current_setting('test.twitch')::uuid;
set local role service_role;
select public.ingest_event('click', null, current_setting('test.twitch')::uuid, 'direct', 'AR', null);
select results_eq(
  $$ select clicks from public.link_stats_daily where link_id = current_setting('test.twitch')::uuid $$,
  $$ values (1) $$, 'un link oculto no suma clics');
reset role;

-- ── Lectura: solo el dueño ──────────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select is((select count(*)::int from public.stats_daily), 1, 'el dueño ve las suyas');
select is((select count(*)::int from public.link_stats_daily), 1, 'y los clics de sus links');
reset role;
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select is(
  (select count(*)::int from public.stats_daily) + (select count(*)::int from public.link_stats_daily)
    + (select count(*)::int from public.stats_breakdown_daily),
  0, 'otro usuario no ve nada ajeno');
reset role;

-- ── Retención ───────────────────────────────────────────────────────────────
insert into public.stats_daily (page_id, day, views)
values ('11111111-1111-4111-8111-111111111111', (now() at time zone 'UTC')::date - 401, 5);
set local role service_role;
select public.ingest_purge_stats();
reset role;
select is(
  (select count(*)::int from public.stats_daily
   where day < (now() at time zone 'UTC')::date - 400), 0,
  'lo de hace más de 400 días se borra');
select is(pg_temp.views_today(), 3, 'lo reciente queda (incluida la visita con país XX)');

select * from finish();
rollback;
