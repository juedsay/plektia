-- "En vivo" en la página pública: solo con "Transmito en este canal", solo si
-- el canal está en vivo y solo si la última revisión es de los últimos 25
-- minutos (datos viejos no anuncian un directo que quizás terminó).
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

create function pg_temp.live_of_juedsay_twitch()
returns jsonb language sql as $$
  select l -> 'live'
  from public.public_page_v, jsonb_array_elements(sections) s, jsonb_array_elements(s -> 'links') l
  where handle = 'juedsay' and l ->> 'providerHandle' = 'juedsay';
$$;

select set_config('test.twitch_link', (
  select id::text from public.links
  where provider_handle = 'juedsay' and page_id = '11111111-1111-4111-8111-111111111111'
), false);

-- Seed: /juedsay tiene Twitch `juedsay`. El refresco lo ve en vivo.
insert into public.provider_channels (id, provider, handle)
values ('c1000000-0000-4000-8000-000000000001', 'twitch', 'juedsay');
insert into public.channel_status (channel_id, is_live, live_title, live_started_at, live_url, checked_at)
values ('c1000000-0000-4000-8000-000000000001', true, 'Programando en vivo',
        now() - interval '1 hour', 'https://www.twitch.tv/juedsay', now() - interval '5 minutes');

select set_config('role', 'anon', true);
select is(pg_temp.live_of_juedsay_twitch(), 'null'::jsonb,
  'sin "Transmito en este canal", no se anuncia aunque esté en vivo');
select throws_ok($$ select * from public.channel_status $$, '42501', null,
  'un visitante no lee el estado directo');
reset role;

insert into public.link_media_settings (link_id, watch_live)
select id, true from public.links
where provider_handle = 'juedsay' and page_id = '11111111-1111-4111-8111-111111111111';

select set_config('role', 'anon', true);
select isnt(public.link_live(current_setting('test.twitch_link')::uuid), null,
  'la función devuelve el directo del link visible');
select is(pg_temp.live_of_juedsay_twitch() - 'startedAt',
  '{"title": "Programando en vivo", "url": "https://www.twitch.tv/juedsay"}'::jsonb,
  'vigilado, en vivo y revisado hace poco: se anuncia');
reset role;

update public.channel_status set checked_at = now() - interval '26 minutes';
select set_config('role', 'anon', true);
select is(pg_temp.live_of_juedsay_twitch(), 'null'::jsonb,
  'con la última revisión de hace más de 25 minutos, no se anuncia');
reset role;

update public.channel_status set checked_at = now(), is_live = false;
select set_config('role', 'anon', true);
select is(pg_temp.live_of_juedsay_twitch(), 'null'::jsonb, 'offline, no se anuncia');
reset role;

update public.channel_status set is_live = true;
update public.links set visible = false
  where provider_handle = 'juedsay' and page_id = '11111111-1111-4111-8111-111111111111';
select set_config('role', 'anon', true);
select is(
  public.link_live(current_setting('test.twitch_link')::uuid),
  null::jsonb, 'un link oculto no anuncia nada (tampoco por la función)');
reset role;

update public.links set visible = true where provider_handle = 'juedsay';
update public.profiles set disabled = true where id = '11111111-1111-4111-8111-111111111111';
select set_config('role', 'anon', true);
select is(
  public.link_live(current_setting('test.twitch_link')::uuid),
  null::jsonb, 'una cuenta dada de baja tampoco');
reset role;

select * from finish();
rollback;
