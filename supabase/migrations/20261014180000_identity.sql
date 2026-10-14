-- Identity (SPEC-identity, tarea 7): registro cerrado por allowlist y perfiles.
--
-- Flujo: Supabase Auth llama al hook `private.before_user_created` antes de crear
-- una cuenta; solo pasan emails invitados y verificados por GitHub o Google. Al
-- insertarse el usuario, un trigger crea su perfil con el handle de la invitación.

create extension if not exists citext with schema extensions;

-- ── Handle ───────────────────────────────────────────────────────────────────
-- Rutas propias de la app que no pueden ser el handle de nadie. La misma lista
-- vive en `src/domain/handle.ts`; un test compara las dos.
create function private.is_reserved_handle(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(value) = any (array[
    '_astro', '.well-known', 'about', 'admin', 'api', 'app', 'assets', 'auth',
    'favicon.ico', 'help', 'login', 'logout', 'mcp', 'new', 'oauth', 'plektia',
    'privacy', 'robots.txt', 'settings', 'signup', 'sitemap.xml', 'static',
    'support', 'terms'
  ]);
$$;

-- 3 a 30 caracteres, minúsculas, números y guiones simples, sin guion al borde.
create domain public.handle as extensions.citext
  check (
    char_length(value) between 3 and 30
    and value::text ~ '^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$'
    and not private.is_reserved_handle(value::text)
  );

create type public.user_role as enum ('owner', 'member');
create type public.profile_theme as enum ('tecnico');

-- ── Allowlist (privada) ──────────────────────────────────────────────────────
create table private.allowed_emails (
  email      extensions.citext primary key check (email::text = lower(trim(email::text))),
  handle     public.handle not null unique,
  role       public.user_role not null default 'member',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── Perfiles (públicos) ──────────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  handle       public.handle not null unique,
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio          text check (char_length(bio) <= 160),
  -- Ruta en Supabase Storage: `{id}/{uuid}.webp` (la subida es de admin-panel).
  avatar_path  text check (avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.webp$')),
  role         public.user_role not null default 'member',
  theme        public.profile_theme not null default 'tecnico',
  -- Un usuario dado de baja no aparece en la página pública ni puede escribir.
  disabled     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Los proyectos nuevos de Supabase ya no exponen las tablas solas: cada
-- privilegio se da explícito. El email nunca está en esta tabla.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
-- Privilegios por columna: nadie se cambia el rol, el handle ni el estado.
grant update (display_name, bio, theme) on public.profiles to authenticated;

create policy "perfiles visibles" on public.profiles
  for select to anon, authenticated
  using (not disabled or id = (select auth.uid()));

-- Solo el dueño, activo, y desde el panel: los clientes MCP (con `client_id`
-- en el JWT) escriben por funciones `mcp_*` acotadas (SPEC-mcp-server).
create policy "el dueño edita su perfil" on public.profiles
  for update to authenticated
  using (
    id = (select auth.uid())
    and not disabled
    and ((select auth.jwt()) ->> 'client_id') is null
  )
  with check (id = (select auth.uid()));

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- ── Hook before_user_created ─────────────────────────────────────────────────
-- Lo ejecuta Supabase Auth (rol supabase_auth_admin) antes de crear la cuenta.
-- Mismo mensaje para cualquier rechazo: no revela si el email está invitado.
create function private.before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user     jsonb := event -> 'user';
  v_provider text  := v_user -> 'app_metadata' ->> 'provider';
  v_email    text  := lower(trim(v_user ->> 'email'));
  v_verified boolean;
begin
  -- `email_verified` lo informa el proveedor en sus claims; solo se confía en
  -- él para GitHub y Google (con email y contraseña, user_metadata lo controla
  -- quien se registra).
  v_verified := v_provider in ('github', 'google')
    and coalesce((v_user -> 'user_metadata' ->> 'email_verified')::boolean, false);

  if v_verified and exists (
    select 1 from private.allowed_emails a where a.email::text = v_email
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Esta cuenta no tiene acceso.'
    )
  );
end;
$$;

-- Supabase da por defecto privilegios a anon y authenticated sobre todo objeto
-- nuevo, en cualquier esquema; los de `private` se quitan explícitamente.
revoke all on private.allowed_emails from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant usage on schema private to supabase_auth_admin;
grant execute on function private.before_user_created(jsonb) to supabase_auth_admin;
grant select on private.allowed_emails to supabase_auth_admin;

-- ── Perfil al crear el usuario ───────────────────────────────────────────────
-- Única forma de crear perfiles. Si la cuenta no tiene invitación (por ejemplo,
-- creada con la API admin), se aborta el alta: no existen usuarios sin perfil.
create function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite private.allowed_emails;
begin
  select * into invite
  from private.allowed_emails a
  where a.email::text = lower(trim(new.email));

  if not found then
    raise exception 'el email no está en la allowlist' using errcode = '42501';
  end if;

  insert into public.profiles (id, handle, display_name, role)
  values (
    new.id,
    invite.handle,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      invite.handle::text
    ), 60),
    invite.role
  );
  return new;
end;
$$;

revoke execute on function private.create_profile_for_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.create_profile_for_new_user();
