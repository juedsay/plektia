-- Contenido destacado en la página pública: se ve solo en links visibles de
-- cuentas activas y si coincide con lo que el dueño eligió; `thumbs` es una
-- ruta reservada.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

create function pg_temp.login(uid uuid)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.featured_of_juedsay_youtube()
returns jsonb language sql as $$
  select l -> 'featured'
  from public.public_page_v, jsonb_array_elements(sections) s, jsonb_array_elements(s -> 'links') l
  where handle = 'juedsay' and l ->> 'providerHandle' = '@juedsay';
$$;

select set_config('test.youtube_link', (
  select id::text from public.links
  where provider_handle = '@juedsay' and page_id = '11111111-1111-4111-8111-111111111111'
), false);

-- Seed: el YouTube de /juedsay destaca "Cómo testeo RLS con pgTAP" (último video).
select set_config('role', 'anon', true);
select is(
  pg_temp.featured_of_juedsay_youtube() - 'publishedAt',
  '{"videoId": "aBcDeFgHiJk", "kind": "video", "title": "Cómo testeo RLS con pgTAP", "durationSeconds": 754, "mode": "latest_video"}'::jsonb,
  'un visitante ve lo destacado del link');
select throws_ok($$ select * from public.featured_content $$, '42501', null,
  'pero no lee la tabla directo');
reset role;

-- Si el dueño cambia a "Último Short", lo viejo no se muestra mientras llega lo nuevo.
select pg_temp.login('11111111-1111-4111-8111-111111111111');
insert into public.link_media_settings (link_id, featured_mode)
select id, 'latest_short' from public.links where provider_handle = '@juedsay'
  and page_id = '11111111-1111-4111-8111-111111111111';
reset role;
select set_config('role', 'anon', true);
select is(pg_temp.featured_of_juedsay_youtube(), 'null'::jsonb,
  'un video largo no se muestra como "Último Short"');
reset role;

select pg_temp.login('11111111-1111-4111-8111-111111111111');
update public.link_media_settings set featured_mode = 'pinned', pinned_video_id = 'aBcDeFgHiJk'
  where link_id = (select id from public.links where provider_handle = '@juedsay'
    and page_id = '11111111-1111-4111-8111-111111111111');
reset role;
select set_config('role', 'anon', true);
select is(pg_temp.featured_of_juedsay_youtube() ->> 'mode', 'pinned',
  'el video fijado se muestra como fijado');
reset role;

-- Un link oculto no deja ver lo destacado, ni llamando a la función directo.
select pg_temp.login('11111111-1111-4111-8111-111111111111');
update public.links set visible = false
  where provider_handle = '@juedsay' and page_id = '11111111-1111-4111-8111-111111111111';
reset role;
select set_config('role', 'anon', true);
select is(
  public.link_featured(current_setting('test.youtube_link')::uuid), null::jsonb,
  'un link oculto no muestra lo destacado (tampoco por la función)');
reset role;

-- Una cuenta dada de baja tampoco.
update public.links set visible = true where provider_handle = '@juedsay';
update public.profiles set disabled = true where id = '11111111-1111-4111-8111-111111111111';
select set_config('role', 'anon', true);
select is(
  public.link_featured(current_setting('test.youtube_link')::uuid), null::jsonb,
  'una cuenta dada de baja no muestra lo destacado');
reset role;
update public.profiles set disabled = false where id = '11111111-1111-4111-8111-111111111111';

-- `thumbs` es una ruta propia.
select is(private.is_reserved_handle('thumbs'), true, '"thumbs" está reservado');
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$ insert into public.pages (handle, display_name) values ('thumbs', 'Copia') $$,
  '23514', null, 'nadie crea la página /thumbs');
reset role;

select * from finish();
rollback;
