-- En vivo repartido a lo largo del día: los canales vigilados vienen del
-- revisado hace más tiempo al más reciente (los nunca revisados, primero), y
-- se puede saber cuánto queda en el más gastado de los fondos.
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

-- Seed: /juedsay (owner 1111…) tiene Twitch `juedsay` y YouTube `@juedsay`.
-- Los dos vigilados; el YouTube, resuelto y revisado hace un rato.
insert into public.link_media_settings (link_id, watch_live)
select id, true from public.links
where provider_handle in ('juedsay', '@juedsay') and page_id = '11111111-1111-4111-8111-111111111111'
on conflict (link_id) do update set watch_live = true;

insert into public.provider_channels (provider, handle, external_id, resolved_at)
values ('youtube', '@juedsay', 'UCjjjjjjjjjjjjjjjjjjjjjj', now())
on conflict (provider, handle) do update set external_id = excluded.external_id;

insert into public.channel_status (channel_id, is_live, checked_at)
select id, false, now() - interval '5 minutes' from public.provider_channels
where provider = 'youtube' and handle = '@juedsay';

set local role service_role;

select results_eq(
  $$ select provider, handle from public.ingest_live_targets() $$,
  $$ values ('twitch', 'juedsay'), ('youtube', '@juedsay') $$,
  'el nunca revisado va primero');
select isnt(
  (select live_checked_at from public.ingest_live_targets() where provider = 'youtube'),
  null, 'con la hora de su última revisión');

select is(
  public.ingest_quota_remaining('{prueba,prueba:live}', '{100,10}'),
  10, 'sin gasto, lo que queda es el tope más chico');
select public.ingest_consume_quota_from('{prueba,prueba:live}', '{100,10}', 4);
select is(
  public.ingest_quota_remaining('{prueba,prueba:live}', '{100,10}'),
  6, 'después de gastar, lo que queda en el más gastado');
select is(
  public.ingest_quota_remaining('{prueba,prueba:live}', '{100,3}'),
  0, 'nunca negativo');
reset role;

set local role authenticated;
select throws_ok(
  $$ select public.ingest_quota_remaining('{youtube}', '{8000}') $$,
  '42501', null, 'solo el refresco consulta la cuota');
reset role;

select * from finish();
rollback;
