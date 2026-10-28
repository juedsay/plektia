-- Usuarios habilitados (tarea 23, SPEC-admin-panel "Usuarios habilitados sin
-- service_role"). Las operaciones de owner son funciones `security definer` que
-- primero verifican, adentro, que quien llama sea un owner activo: el panel
-- nunca usa la `service_role`. Cada operación queda en `private.audit_log`.

-- ── 1. Auditoría ─────────────────────────────────────────────────────────────
create table private.audit_log (
  id            bigint generated always as identity primary key,
  actor_id      uuid not null,
  action        text not null check (action in ('invite', 'revoke')),
  target_email  extensions.citext not null,
  target_handle text,
  created_at    timestamptz not null default now()
);

revoke all on private.audit_log from public, anon, authenticated;

-- ── 2. ¿Quien llama es un owner activo? ──────────────────────────────────────
create function private.caller_is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'owner' and not p.disabled
  );
$$;

revoke all on function private.caller_is_owner() from public, anon, authenticated;

-- ── 3. Invitar ───────────────────────────────────────────────────────────────
-- Devuelve el resultado como texto (para mostrarlo junto al campo); solo un
-- owner la puede llamar (si no, 42501). Siempre invita como `member`.
create function public.admin_invite(target_email text, target_handle text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email  text := lower(trim(coalesce(target_email, '')));
  v_handle text := lower(trim(coalesce(target_handle, '')));
begin
  if not private.caller_is_owner() then
    raise exception 'solo un owner puede invitar' using errcode = '42501';
  end if;

  if char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return 'invalid_email';
  end if;

  -- Las mismas reglas que cualquier handle (formato y reservados), y el oficial
  -- no se regala: es de la cuenta Admin.
  begin
    perform v_handle::public.handle;
  exception when check_violation then
    return 'invalid_handle';
  end;
  if private.is_official_handle(v_handle) then
    return 'invalid_handle';
  end if;

  if exists (select 1 from private.allowed_emails a where a.email = v_email::extensions.citext)
     or exists (select 1 from auth.users u where lower(u.email) = v_email) then
    return 'email_taken';
  end if;
  if exists (select 1 from public.pages p where p.handle = v_handle::public.handle)
     or exists (select 1 from private.allowed_emails a where a.handle = v_handle::public.handle) then
    return 'handle_taken';
  end if;

  begin
    insert into private.allowed_emails (email, handle, role, invited_by)
    values (v_email, v_handle, 'member', (select auth.uid()));
  exception when unique_violation then
    -- Otra invitación igual entró en el medio.
    return case
      when exists (select 1 from private.allowed_emails a where a.email = v_email::extensions.citext)
        then 'email_taken'
      else 'handle_taken'
    end;
  end;

  insert into private.audit_log (actor_id, action, target_email, target_handle)
  values ((select auth.uid()), 'invite', v_email, v_handle);
  return 'invited';
end;
$$;

-- ── 4. Quitar el acceso ──────────────────────────────────────────────────────
-- Borra la invitación y, si la cuenta ya existe, la marca `disabled`: su página
-- deja de publicarse y la RLS rechaza sus escrituras, aunque tenga una sesión
-- abierta. Nadie se quita el acceso a sí mismo (así nunca queda la plataforma
-- sin un owner). Devuelve los handles de sus páginas, para purgar la caché.
create function public.admin_revoke(target_email text)
returns table (status text, handles text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email  text := lower(trim(coalesce(target_email, '')));
  v_user   uuid;
  v_invite text;
  v_pages  text[];
begin
  if not private.caller_is_owner() then
    raise exception 'solo un owner puede quitar el acceso' using errcode = '42501';
  end if;

  -- Primero la invitación, con bloqueo: si esa persona se está dando de alta en
  -- este momento (el alta la toma `for share`), se espera a que termine y la
  -- consulta de abajo ya ve su cuenta. Si la baja llega primero, el alta espera,
  -- no encuentra la invitación y se rechaza.
  select a.handle::text into v_invite from private.allowed_emails a
  where a.email = v_email::extensions.citext
  for update;
  select u.id into v_user from auth.users u where lower(u.email) = v_email;

  if v_user is null and v_invite is null then
    return query select 'not_found'::text, array[]::text[];
    return;
  end if;
  if v_user = (select auth.uid()) then
    return query select 'self'::text, array[]::text[];
    return;
  end if;

  if v_user is not null then
    update public.profiles set disabled = true where id = v_user;
    select coalesce(array_agg(p.handle::text order by p.created_at), array[]::text[])
    into v_pages
    from public.pages p where p.owner_id = v_user;
  end if;
  delete from private.allowed_emails a where a.email = v_email::extensions.citext;

  insert into private.audit_log (actor_id, action, target_email, target_handle)
  values ((select auth.uid()), 'revoke', v_email, coalesce(v_invite, v_pages[1]));
  return query select 'revoked'::text, coalesce(v_pages, array[]::text[]);
end;
$$;

-- ── 5. Listar ────────────────────────────────────────────────────────────────
-- Invitaciones pendientes, cuentas activas y dadas de baja. Solo un owner: es
-- el único lugar donde la app ve emails de otras personas.
create function public.admin_list_users()
returns table (
  email           text,
  handle          text,
  role            public.user_role,
  status          text,
  invited_at      timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.caller_is_owner() then
    raise exception 'solo un owner puede ver los usuarios' using errcode = '42501';
  end if;

  return query
  with accounts as (
    select
      lower(u.email) as email,
      u.id,
      u.created_at,
      u.last_sign_in_at,
      p.role,
      p.disabled,
      (select pg.handle::text from public.pages pg
       where pg.owner_id = u.id order by pg.created_at limit 1) as handle
    from auth.users u
    join public.profiles p on p.id = u.id
  )
  select
    coalesce(accounts.email, invites.email::text),
    coalesce(accounts.handle, invites.handle::text),
    coalesce(accounts.role, invites.role),
    case
      when accounts.id is null then 'invited'
      when accounts.disabled then 'disabled'
      else 'active'
    end,
    coalesce(invites.created_at, accounts.created_at),
    accounts.last_sign_in_at
  from accounts
  full outer join private.allowed_emails invites on invites.email::text = accounts.email
  order by 4, 1;
end;
$$;

-- ── 6. El alta toma la invitación con bloqueo ────────────────────────────────
-- Igual que en la migración de páginas, más `for share`: así una baja simultánea
-- (que la toma `for update`) se serializa con el alta y nunca queda una cuenta
-- activa con la invitación ya borrada.
create or replace function private.create_profile_for_new_user()
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
  where a.email::text = lower(trim(new.email))
  for share;

  if not found then
    raise exception 'el email no está en la allowlist' using errcode = '42501';
  end if;

  insert into public.profiles (id, role) values (new.id, invite.role);
  insert into public.pages (owner_id, handle, display_name)
  values (
    new.id,
    invite.handle,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      invite.handle::text
    ), 60)
  );
  return new;
end;
$$;

-- ── 7. El handle de una invitación queda reservado para esa persona ──────────
-- Si otra cuenta creara una página con ese handle antes de que la persona
-- invitada entre, su alta fallaría. Responde como un handle tomado (23505).
create function private.guard_invited_handle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from private.allowed_emails a
    where a.handle = new.handle
      and a.email::text <> coalesce(
        (select lower(u.email) from auth.users u where u.id = new.owner_id), ''
      )
  ) then
    raise exception 'ese handle está reservado para una invitación' using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_invited_handle() from public, anon, authenticated;

create trigger pages_invited_handle
  before insert or update of handle on public.pages
  for each row execute function private.guard_invited_handle();

-- ── 8. Una cuenta dada de baja tampoco escribe en Storage ────────────────────
drop policy "avatares: cada cuenta sube a su carpeta" on storage.objects;
create policy "avatares: cada cuenta sube a su carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
    and storage.filename(name) ~ '^[0-9a-f-]{36}\.(webp|jpg)$'
    and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled
    )
  );

drop policy "avatares: cada cuenta borra de su carpeta" on storage.objects;
create policy "avatares: cada cuenta borra de su carpeta" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled
    )
  );

revoke all on function public.admin_invite(text, text) from public, anon;
revoke all on function public.admin_revoke(text) from public, anon;
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_invite(text, text) to authenticated;
grant execute on function public.admin_revoke(text) to authenticated;
grant execute on function public.admin_list_users() to authenticated;
