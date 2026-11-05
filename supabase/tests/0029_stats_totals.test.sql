-- Totales del período en la base: una fila por link o por valor, ya sumada
-- (más de 1000 filas diarias no cortan el total), con la RLS de quien llama.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

create function pg_temp.login(uid uuid, client_id text default null)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', 'authenticated', 'client_id', client_id))::text,
           true);
$$;

-- Página 1111… (/juedsay): un link con 1200 días de un clic, y 1200 días de
-- visitas desde AR. Una conexión revocada del dueño.
insert into public.links (id, owner_id, page_id, title, url) values
  ('c3000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-111111111111', 'Muchos días', 'https://ejemplo.com/dias');
insert into public.link_stats_daily (link_id, day, clicks)
  select 'c3000000-0000-4000-8000-000000000001', date '2020-01-01' + n, 1
  from generate_series(0, 1199) n;
insert into public.stats_breakdown_daily (page_id, day, dimension, value, views, clicks)
  select '11111111-1111-4111-8111-111111111111', date '2020-01-01' + n, 'country', 'AR', 2, 1
  from generate_series(0, 1199) n;
insert into public.mcp_grants (client_id, user_id, client_name, redirect_host, can_write, revoked_at) values
  ('a0000000-0000-4000-8000-00000000000b', '11111111-1111-4111-8111-111111111111', 'Vieja', 'vieja.example', false, now());

-- ── El dueño ve el total del período ─────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select is(
  (select clicks::int from public.page_link_clicks(
     '11111111-1111-4111-8111-111111111111', '2020-01-01', '2023-12-31')
   where link_id = 'c3000000-0000-4000-8000-000000000001'),
  1200, 'los clics de 1200 días suman en una sola fila');
select is(
  (select clicks::int from public.page_link_clicks(
     '11111111-1111-4111-8111-111111111111', '2020-01-01', '2020-01-10')
   where link_id = 'c3000000-0000-4000-8000-000000000001'),
  10, 'solo cuenta los días del período, con los dos extremos');
select is(
  (select title from public.page_link_clicks(
     '11111111-1111-4111-8111-111111111111', '2020-01-01', '2023-12-31')
   where link_id = 'c3000000-0000-4000-8000-000000000001'),
  'Muchos días', 'con el título actual del link');
select results_eq(
  $$ select views::int, clicks::int from public.page_stats_breakdown(
       '11111111-1111-4111-8111-111111111111', '2020-01-01', '2023-12-31')
     where dimension = 'country' and value = 'AR' $$,
  $$ values (2400, 1200) $$,
  'países y orígenes también suman en una fila por valor');

-- ── Nadie más ────────────────────────────────────────────────────────────────
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select is_empty(
  $$ select 1 from public.page_link_clicks('11111111-1111-4111-8111-111111111111', '2020-01-01', '2023-12-31') $$,
  'otra cuenta no ve los clics de una página ajena');
select is_empty(
  $$ select 1 from public.page_stats_breakdown('11111111-1111-4111-8111-111111111111', '2020-01-01', '2023-12-31') $$,
  'ni sus países y orígenes');

select pg_temp.login('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-00000000000b');
select is_empty(
  $$ select 1 from public.page_link_clicks('11111111-1111-4111-8111-111111111111', '2020-01-01', '2023-12-31') $$,
  'una conexión revocada no ve los totales');
select is_empty(
  $$ select 1 from public.page_stats_breakdown('11111111-1111-4111-8111-111111111111', '2020-01-01', '2023-12-31') $$,
  'ni países y orígenes');
reset role;

select set_config('role', 'anon', true);
select throws_ok(
  $$ select * from public.page_link_clicks('11111111-1111-4111-8111-111111111111', '2020-01-01', '2023-12-31') $$,
  '42501', null, 'un visitante no puede llamarla');
reset role;

select * from finish();
rollback;
