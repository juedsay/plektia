-- Links: orden atómico con reorder_sections y move_links (SPEC-links,
-- "Operaciones atómicas"; SPEC-pages): listas completas, dueño, página,
-- versiones y atomicidad.
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

create function pg_temp.login(uid uuid)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.as_anon()
returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '', true);
$$;

-- Versiones actuales de una lista de ids, en el mismo orden.
create function pg_temp.versions_of(table_name text, ids uuid[])
returns integer[] language plpgsql as $$
declare result integer[];
begin
  execute format(
    'select array_agg(t.version order by u.ord) from unnest($1) with ordinality u(id, ord) join public.%I t on t.id = u.id',
    table_name) into result using ids;
  return result;
end;
$$;

-- Punto de partida propio, sin depender del seed (la transacción se descarta al final).
delete from public.links where owner_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');
delete from public.sections where owner_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');
update public.pages set bio = null;

-- Dueño 1111… (página 1111…): secciones A, B, C. Links: a1, a2 en A; n1, n2 sin sección.
-- Su segunda página 5555…: sección S2 y link s1, sin sección.
-- Otro usuario 2222… (página 2222…): sección Z y link z1.
insert into public.pages (id, owner_id, handle, display_name) values
  ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'segunda-pagina', 'Segunda');
insert into public.sections (id, owner_id, page_id, title) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'A'),
  ('aaaaaaaa-0000-4000-8000-00000000000b', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'B'),
  ('aaaaaaaa-0000-4000-8000-00000000000c', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'C'),
  ('aaaaaaaa-0000-4000-8000-0000000000ff', '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'Z'),
  ('aaaaaaaa-0000-4000-8000-0000000000d2', '11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', 'S2');
insert into public.links (id, owner_id, page_id, section_id, title, url) values
  ('bbbbbbbb-0000-4000-8000-0000000000a1', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-00000000000a', 'a1', 'https://plektia.app/a1'),
  ('bbbbbbbb-0000-4000-8000-0000000000a2', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-00000000000a', 'a2', 'https://plektia.app/a2'),
  ('bbbbbbbb-0000-4000-8000-0000000000e1', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', null, 'n1', 'https://plektia.app/n1'),
  ('bbbbbbbb-0000-4000-8000-0000000000e2', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', null, 'n2', 'https://plektia.app/n2'),
  ('bbbbbbbb-0000-4000-8000-0000000000f1', '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-0000-4000-8000-0000000000ff', 'z1', 'https://plektia.app/z1'),
  ('bbbbbbbb-0000-4000-8000-0000000000d1', '11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', null, 's1', 'https://plektia.app/s1');

-- ── reorder_sections ─────────────────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ select public.reorder_sections(
       '11111111-1111-4111-8111-111111111111',
       array['aaaaaaaa-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-00000000000b']::uuid[],
       pg_temp.versions_of('sections', array['aaaaaaaa-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-00000000000b']::uuid[])) $$,
  'reorder_sections: el dueño reordena sus secciones');
select results_eq(
  $$ select title from public.sections where page_id = '11111111-1111-4111-8111-111111111111' order by position $$,
  $$ values ('C'), ('A'), ('B') $$, 'reorder_sections: queda el orden pedido');
select throws_ok(
  $$ select public.reorder_sections(
       '11111111-1111-4111-8111-111111111111',
       array['aaaaaaaa-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-00000000000b', 'aaaaaaaa-0000-4000-8000-00000000000c']::uuid[],
       array[1, 1, 1]) $$,
  'PL409', null, 'reorder_sections: con versiones viejas da conflicto');
select results_eq(
  $$ select title from public.sections where page_id = '11111111-1111-4111-8111-111111111111' order by position $$,
  $$ values ('C'), ('A'), ('B') $$, 'reorder_sections: un conflicto no cambia nada');
select throws_ok(
  $$ select public.reorder_sections('11111111-1111-4111-8111-111111111111', array['aaaaaaaa-0000-4000-8000-00000000000a']::uuid[], array[2]) $$,
  'PL400', null, 'reorder_sections: rechaza una lista parcial');
select throws_ok(
  $$ select public.reorder_sections(
       '11111111-1111-4111-8111-111111111111',
       array['aaaaaaaa-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-00000000000b', 'aaaaaaaa-0000-4000-8000-0000000000ff']::uuid[],
       array[2, 2, 1]) $$,
  'PL400', null, 'reorder_sections: rechaza una lista con secciones de otro');
select throws_ok(
  $$ select public.reorder_sections(
       '11111111-1111-4111-8111-111111111111',
       array['aaaaaaaa-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-00000000000b']::uuid[],
       array[2, 2, 2]) $$,
  'PL400', null, 'reorder_sections: rechaza ids repetidos');
select throws_ok(
  $$ select public.reorder_sections('11111111-1111-4111-8111-111111111111', array[]::uuid[], array[1]) $$,
  'PL400', null, 'reorder_sections: rechaza listas de distinto largo');
select throws_ok(
  $$ select public.reorder_sections('22222222-2222-4222-8222-222222222222', array['aaaaaaaa-0000-4000-8000-0000000000ff']::uuid[], array[1]) $$,
  'PL404', null, 'reorder_sections: rechaza la página de otro usuario');
select throws_ok(
  $$ select public.reorder_sections(
       '55555555-5555-4555-8555-555555555555',
       array['aaaaaaaa-0000-4000-8000-0000000000d2', 'aaaaaaaa-0000-4000-8000-00000000000a']::uuid[],
       array[1, 2]) $$,
  'PL400', null, 'reorder_sections: rechaza secciones de otra página propia');
reset role;

select pg_temp.as_anon();
select throws_ok(
  $$ select public.reorder_sections(null, array[]::uuid[], array[]::integer[]) $$,
  '42501', null, 'reorder_sections: anon no la puede ejecutar');
reset role;

-- ── move_links ───────────────────────────────────────────────────────────────
select pg_temp.login('11111111-1111-4111-8111-111111111111');
-- Trae n2 al principio de A: el orden final completo de A es n2, a1, a2.
select lives_ok(
  $$ select public.move_links(
       '11111111-1111-4111-8111-111111111111',
       'aaaaaaaa-0000-4000-8000-00000000000a',
       array['bbbbbbbb-0000-4000-8000-0000000000e2', 'bbbbbbbb-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-0000000000a2']::uuid[],
       pg_temp.versions_of('links', array['bbbbbbbb-0000-4000-8000-0000000000e2', 'bbbbbbbb-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-0000000000a2']::uuid[])) $$,
  'move_links: mueve un link a otra sección en una posición');
select results_eq(
  $$ select title, position from public.links where section_id = 'aaaaaaaa-0000-4000-8000-00000000000a' order by position $$,
  $$ values ('n2', 0), ('a1', 1), ('a2', 2) $$, 'move_links: el grupo destino queda en el orden pedido');
select results_eq(
  $$ select title, position from public.links where page_id = '11111111-1111-4111-8111-111111111111' and section_id is null order by position $$,
  $$ values ('n1', 0) $$, 'move_links: el grupo de origen queda compacto');
select throws_ok(
  $$ select public.move_links(
       '11111111-1111-4111-8111-111111111111',
       'aaaaaaaa-0000-4000-8000-00000000000a',
       array['bbbbbbbb-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-0000000000a2']::uuid[],
       pg_temp.versions_of('links', array['bbbbbbbb-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-0000000000a2']::uuid[])) $$,
  'PL400', null, 'move_links: rechaza una lista que deja afuera links del grupo');
select throws_ok(
  $$ select public.move_links(
       '11111111-1111-4111-8111-111111111111',
       null,
       array['bbbbbbbb-0000-4000-8000-0000000000e1', 'bbbbbbbb-0000-4000-8000-0000000000f1']::uuid[],
       array[1, 1]) $$,
  'PL400', null, 'move_links: rechaza links de otro usuario');
select throws_ok(
  $$ select public.move_links(
       '11111111-1111-4111-8111-111111111111',
       'aaaaaaaa-0000-4000-8000-0000000000ff',
       array['bbbbbbbb-0000-4000-8000-0000000000e1']::uuid[],
       array[1]) $$,
  'PL404', null, 'move_links: rechaza mover a la sección de otro usuario');
select throws_ok(
  $$ select public.move_links(
       '11111111-1111-4111-8111-111111111111',
       'aaaaaaaa-0000-4000-8000-00000000000a',
       array['bbbbbbbb-0000-4000-8000-0000000000a2', 'bbbbbbbb-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-0000000000e2']::uuid[],
       array[1, 1, 1]) $$,
  'PL409', null, 'move_links: con versiones viejas da conflicto');
select throws_ok(
  $$ select public.move_links('22222222-2222-4222-8222-222222222222', null, array['bbbbbbbb-0000-4000-8000-0000000000f1']::uuid[], array[1]) $$,
  'PL404', null, 'move_links: rechaza la página de otro usuario');
select throws_ok(
  $$ select public.move_links(
       '11111111-1111-4111-8111-111111111111', null,
       array['bbbbbbbb-0000-4000-8000-0000000000e1', 'bbbbbbbb-0000-4000-8000-0000000000d1']::uuid[],
       array[1, 1]) $$,
  'PL400', null, 'move_links: no trae links de otra página propia');
select throws_ok(
  $$ select public.move_links(
       '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-0000000000d2',
       array['bbbbbbbb-0000-4000-8000-0000000000e1']::uuid[],
       array[1]) $$,
  'PL404', null, 'move_links: rechaza una sección de otra página propia');
select results_eq(
  $$ select title from public.links where section_id = 'aaaaaaaa-0000-4000-8000-00000000000a' order by position $$,
  $$ values ('n2'), ('a1'), ('a2') $$, 'move_links: un conflicto no cambia nada');
reset role;

-- El link del otro usuario sigue intacto.
select results_eq(
  $$ select section_id, position from public.links where id = 'bbbbbbbb-0000-4000-8000-0000000000f1' $$,
  $$ values ('aaaaaaaa-0000-4000-8000-0000000000ff'::uuid, 0) $$,
  'move_links: nunca toca links de otro usuario');

-- ── Atomicidad: 50 links reordenados al azar 20 veces ────────────────────────
insert into public.links (owner_id, page_id, section_id, title, url)
select '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-00000000000b', 'r' || g, 'https://plektia.app/r' || g
from generate_series(1, 50) g;

select pg_temp.login('11111111-1111-4111-8111-111111111111');
create function pg_temp.shuffle_b(rounds integer)
returns integer language plpgsql as $$
declare
  ids uuid[];
  ok_rounds integer := 0;
begin
  for i in 1..rounds loop
    select array_agg(id order by random()) into ids
    from public.links where section_id = 'aaaaaaaa-0000-4000-8000-00000000000b';
    perform public.move_links('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-00000000000b', ids, pg_temp.versions_of('links', ids));
    set constraints all immediate;
    set constraints all deferred;
    -- Posiciones 0..49 exactas: sin repetidas ni huecos, y en el orden pedido.
    if (select array_agg(id order by position) from public.links
        where section_id = 'aaaaaaaa-0000-4000-8000-00000000000b') = ids
      and (select array_agg(position order by position) from public.links
        where section_id = 'aaaaaaaa-0000-4000-8000-00000000000b')
        = (select array_agg(g) from generate_series(0, 49) g) then
      ok_rounds := ok_rounds + 1;
    end if;
  end loop;
  return ok_rounds;
end;
$$;
select is(pg_temp.shuffle_b(20), 20,
  'atomicidad: 20 reordenamientos al azar de 50 links, siempre sin repetidas ni huecos');
reset role;

-- Un fallo a mitad de camino no deja nada a medias: la versión de un link de la
-- lista cambia "en el medio" y move_links rechaza todo.
select pg_temp.login('11111111-1111-4111-8111-111111111111');
create temp table before_fail as
  select id, position from public.links where section_id = 'aaaaaaaa-0000-4000-8000-00000000000b';
create function pg_temp.fail_midway()
returns void language plpgsql as $$
declare ids uuid[]; versions integer[];
begin
  select array_agg(id order by position desc) into ids
  from public.links where section_id = 'aaaaaaaa-0000-4000-8000-00000000000b';
  versions := pg_temp.versions_of('links', ids);
  versions[50] := versions[50] - 1;
  perform public.move_links('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-00000000000b', ids, versions);
end;
$$;
select throws_ok('select pg_temp.fail_midway()', 'PL409', null, 'atomicidad: una versión vieja en la lista da conflicto');
select results_eq(
  $$ select id, position from public.links where section_id = 'aaaaaaaa-0000-4000-8000-00000000000b' order by position $$,
  $$ select id, position from before_fail order by position $$,
  'atomicidad: el conflicto no cambió ninguna posición');
reset role;

select lives_ok('set constraints all immediate', 'al final, ninguna posición repetida');

select * from finish();
rollback;
