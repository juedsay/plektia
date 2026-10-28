-- Página oficial (tarea 21b): `/plektia` es de la cuenta Admin (owner) y solo
-- una cuenta owner puede tener ese handle, en una página o en una invitación.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

create function pg_temp.login(uid uuid)
returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- En el seed: owner 1111… (/juedsay), miembro 2222… y la Admin adad… (/plektia).
select is(
  (select owner_id from public.pages where handle = 'plektia'),
  'adadadad-0000-4000-8000-00000000ad01'::uuid,
  'la página oficial es de la cuenta Admin');
select is(
  (select role from public.profiles where id = 'adadadad-0000-4000-8000-00000000ad01'),
  'owner'::public.user_role,
  'la cuenta Admin es owner');
select is(
  (select count(*)::int from public.public_page_v where handle = 'plektia'), 1,
  'la página oficial se lee como cualquier página pública');

-- Los demás handles reservados siguen reservados.
select throws_ok(
  $$ insert into private.allowed_emails (email, handle, role) values ('x@plektia.test', 'admin', 'owner') $$,
  '23514', null, 'un handle reservado sigue sin poder usarse');

-- Para probar quién puede tomar el handle, la Admin pasa a tener otra página y
-- se borra la oficial (la única página de una cuenta no se puede borrar).
insert into public.pages (owner_id, handle, display_name)
values ('adadadad-0000-4000-8000-00000000ad01', 'admin-temporal', 'Temporal');
delete from public.pages where handle = 'plektia';
-- Su invitación también reserva el handle (0010): se libera para probar solo la
-- regla del handle oficial.
delete from private.allowed_emails where handle = 'plektia';

-- Una invitación con el handle oficial solo puede ser de owner.
select throws_ok(
  $$ insert into private.allowed_emails (email, handle, role) values ('otra@plektia.test', 'plektia', 'member') $$,
  '23514', null, 'una invitación de member no puede llevar el handle oficial');

-- Un member no puede tomar el handle oficial creando una página.
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$ insert into public.pages (handle, display_name) values ('plektia', 'Copia') $$,
  '42501', null, 'un member no puede crear la página oficial');
reset role;

-- Un owner sí (es como la recibe la cuenta Admin).
select pg_temp.login('11111111-1111-4111-8111-111111111111');
delete from public.pages
where owner_id = '11111111-1111-4111-8111-111111111111' and handle <> 'juedsay';
select lives_ok(
  $$ insert into public.pages (handle, display_name) values ('plektia', 'Plektia') $$,
  'un owner puede tener la página oficial');
reset role;

-- Quien tiene la página oficial no deja de ser owner.
select throws_ok(
  $$ update public.profiles set role = 'member' where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501', null, 'la cuenta de la página oficial no pasa a member');
select lives_ok(
  $$ update public.profiles set role = 'member' where id = 'adadadad-0000-4000-8000-00000000ad01' $$,
  'una cuenta sin la página oficial sí puede pasar a member');

select * from finish();
rollback;
