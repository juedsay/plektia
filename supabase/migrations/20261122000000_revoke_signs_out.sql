-- Dar de baja una cuenta (admin_revoke) ahora también cierra sus sesiones y
-- desconecta sus apps de IA (auditoría de seguridad, punto diferido). Antes
-- solo marcaba `disabled`: la RLS frenaba sus escrituras, pero la sesión y los
-- refresh tokens seguían vivos y las conexiones MCP figuraban como activas.
-- El resto de la función no cambia.

create or replace function public.admin_revoke(target_email text)
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
    -- Sin sesiones: el refresh token deja de servir y la próxima renovación
    -- (como mucho, al vencer el access token) la saca del panel. Las sesiones de
    -- las apps de IA son sesiones también.
    delete from auth.sessions s where s.user_id = v_user;
    -- Y sus apps conectadas quedan desconectadas: `/mcp` las rechaza ya.
    update public.mcp_grants g set revoked_at = coalesce(g.revoked_at, now())
    where g.user_id = v_user;
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
