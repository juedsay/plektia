-- Tarea 21b: la página oficial (`/plektia`) pasa del repo a la base, a nombre de
-- la cuenta Admin de Plektia (rol `owner`), y se edita desde el panel como
-- cualquier otra. `plektia` deja de ser un handle reservado para la base, pero
-- solo lo puede tener una cuenta `owner`: en una invitación o en una página.
-- La app lo sigue tratando como reservado (nadie lo puede pedir desde el panel).

-- La misma lista que `src/domain/handle.ts`, sin el handle oficial.
create or replace function private.is_reserved_handle(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(value) = any (array[
    '_astro', '.well-known', 'about', 'admin', 'api', 'app', 'assets', 'auth',
    'contact', 'contacto', 'favicon.ico', 'help', 'legal', 'login', 'logout', 'mcp',
    'new', 'oauth', 'privacidad', 'privacy', 'robots.txt', 'settings',
    'signup', 'sitemap.xml', 'static', 'support', 'terms'
  ]);
$$;

-- El handle de la página oficial (`OFFICIAL_HANDLE` en `src/domain/handle.ts`).
create function private.is_official_handle(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(value) = 'plektia';
$$;

revoke all on function private.is_official_handle(text) from public, anon, authenticated;

-- Una invitación con el handle oficial solo puede ser de `owner`.
alter table private.allowed_emails
  add constraint allowed_emails_official_handle_is_owner
  check (not private.is_official_handle(handle::text) or role = 'owner');

-- Una página con el handle oficial solo puede ser de una cuenta `owner`.
create function private.guard_official_page()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_official_handle(new.handle::text) and not exists (
    select 1 from public.profiles p where p.id = new.owner_id and p.role = 'owner'
  ) then
    raise exception 'la página oficial es solo de la cuenta de Plektia' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_official_page() from public, anon, authenticated;

create trigger pages_official_handle
  before insert or update of handle, owner_id on public.pages
  for each row execute function private.guard_official_page();

-- Y quien tiene la página oficial no deja de ser `owner` (primero se pasa la
-- página a otra cuenta Admin).
create function private.guard_official_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role <> 'owner' and exists (
    select 1 from public.pages p
    where p.owner_id = new.id and private.is_official_handle(p.handle::text)
  ) then
    raise exception 'la cuenta de la página oficial tiene que ser owner' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_official_owner() from public, anon, authenticated;

create trigger profiles_official_owner
  before update of role on public.profiles
  for each row execute function private.guard_official_owner();
