-- `/contact` es la página de contacto (las rutas propias van en inglés);
-- `contacto` sigue reservado porque redirige ahí. La misma lista vive en
-- `src/domain/handle.ts`; un test compara la definición más reciente.
create or replace function private.is_reserved_handle(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(value) = any (array[
    '_astro', '.well-known', 'about', 'admin', 'api', 'app', 'assets', 'auth',
    'contact', 'contacto', 'favicon.ico', 'help', 'login', 'logout', 'mcp', 'new',
    'oauth', 'plektia', 'privacidad', 'privacy', 'robots.txt', 'settings', 'signup',
    'sitemap.xml', 'static', 'support', 'terms'
  ]);
$$;

-- Reservar una palabra no toca los datos que ya existen: el `check` del dominio
-- solo se aplica a lo nuevo. Si un perfil o una invitación ya usara una palabra
-- recién reservada, quedaría tapado por la página propia (o la invitación
-- fallaría al registrarse). En vez de romperlo en silencio, el deploy se frena
-- y alguien decide qué handle nuevo darle.
create function private.assert_no_reserved_handles_in_use()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_taken text;
begin
  select string_agg(handle, ', ' order by handle) into v_taken
  from (
    select p.handle::text as handle from public.profiles p
    where private.is_reserved_handle(p.handle::text)
    union
    select a.handle::text from private.allowed_emails a
    where private.is_reserved_handle(a.handle::text)
  ) taken;

  if v_taken is not null then
    raise exception 'handles reservados en uso: %', v_taken
      using hint = 'Cambiá esos handles antes de aplicar la migración.';
  end if;
end;
$$;

revoke all on function private.assert_no_reserved_handles_in_use() from public, anon, authenticated;

select private.assert_no_reserved_handles_in_use();
