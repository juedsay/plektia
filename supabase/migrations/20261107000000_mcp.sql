-- MCP: grants y escrituras `mcp_*` (tarea 29, SPEC-mcp-server).
--
-- Un cliente MCP usa un JWT de Supabase con el claim `client_id`. Las políticas
-- de escritura ya exigen `client_id is null` (solo el panel escribe directo en
-- las tablas), así que el cliente escribe solo por estas funciones, que:
--   1. verifican que haya un grant activo para ese cliente y usuario, y
--      `can_write` si la operación escribe;
--   2. fijan el dueño con `auth.uid()` y solo tocan filas suyas;
--   3. registran la auditoría (app y herramienta);
--   4. hacen la misma operación que el panel, con los mismos checks y triggers.
--
-- Son `security definer` porque la RLS cierra la puerta al `client_id`: por eso
-- cada una filtra por dueño de forma explícita. Errores: PL400 invalid_input ·
-- PL404 not_found · PL409 conflict · 42501 forbidden.

-- ── 1. Grants ────────────────────────────────────────────────────────────────
create table public.mcp_grants (
  client_id     uuid not null,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  -- Declarado por la app al registrarse: no está verificado.
  client_name   text not null check (
    char_length(btrim(client_name)) between 1 and 100 and client_name !~ '[[:cntrl:]]'
  ),
  redirect_host text not null check (
    char_length(redirect_host) between 1 and 253 and redirect_host ~ '^[A-Za-z0-9.:\[\]-]+$'
  ),
  can_write     boolean not null default false,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  primary key (client_id, user_id)
);

create index mcp_grants_user on public.mcp_grants (user_id, created_at);

alter table public.mcp_grants enable row level security;

-- El dueño ve sus conexiones y les cambia el permiso, solo desde el panel: un
-- cliente MCP no puede listar las otras apps ni darse permiso de escritura.
-- Alta (consentimiento) y revocación van por funciones.
revoke all on public.mcp_grants from anon, authenticated;
grant select on public.mcp_grants to authenticated;
grant update (can_write) on public.mcp_grants to authenticated;

create policy "el dueño ve sus conexiones" on public.mcp_grants
  for select to authenticated
  using (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'client_id') is null);

create policy "el dueño cambia el permiso de sus conexiones" on public.mcp_grants
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and revoked_at is null
    and ((select auth.jwt()) ->> 'client_id') is null
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
  )
  with check (user_id = (select auth.uid()));

-- ── 2. Auditoría de lo que hace cada app ─────────────────────────────────────
create table private.mcp_audit_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null,
  client_id  uuid not null,
  tool       text not null check (tool ~ '^[a-z_]{1,40}$'),
  target_id  uuid,
  created_at timestamptz not null default now()
);

create index mcp_audit_log_user on private.mcp_audit_log (user_id, created_at);

revoke all on private.mcp_audit_log from public, anon, authenticated;

-- ── 3. ¿Quién llama? ─────────────────────────────────────────────────────────
-- Un cliente MCP con grant activo (y `can_write` si escribe), con su perfil
-- activo. Devuelve el usuario; si no, 42501. Anota el último uso (como mucho
-- una vez por minuto, para no escribir en cada llamada).
create function private.mcp_caller(p_write boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_client    text := (select auth.jwt()) ->> 'client_id';
  v_client_id uuid;
  v_grant     public.mcp_grants%rowtype;
begin
  if v_uid is null or v_client is null
    or v_client !~ '^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$' then
    raise exception 'solo para clientes MCP' using errcode = '42501';
  end if;
  v_client_id := v_client::uuid;

  select * into v_grant from public.mcp_grants g
  where g.client_id = v_client_id and g.user_id = v_uid and g.revoked_at is null;
  if not found then
    raise exception 'la conexión no existe o fue revocada' using errcode = '42501';
  end if;
  if p_write and not v_grant.can_write then
    raise exception 'la conexión es de solo lectura' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and not p.disabled) then
    raise exception 'la cuenta está deshabilitada' using errcode = '42501';
  end if;

  update public.mcp_grants g set last_used_at = now()
  where g.client_id = v_client_id and g.user_id = v_uid
    and (g.last_used_at is null or g.last_used_at < now() - interval '1 minute');
  return v_uid;
end;
$$;

create function private.mcp_audit(p_user uuid, p_tool text, p_target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.mcp_audit_log (user_id, client_id, tool, target_id)
  values (p_user, ((select auth.jwt()) ->> 'client_id')::uuid, p_tool, p_target);
$$;

-- El panel (sesión propia, sin `client_id`) con su perfil activo.
create function private.panel_caller()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or ((select auth.jwt()) ->> 'client_id') is not null
    or not exists (select 1 from public.profiles p where p.id = v_uid and not p.disabled) then
    raise exception 'solo desde el panel' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- La página es del usuario (si no, PL404: no se distingue de una que no existe).
create function private.mcp_own_page(p_user uuid, p_page uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.pages p where p.id = p_page and p.owner_id = p_user) then
    raise exception 'la página no existe' using errcode = 'PL404';
  end if;
end;
$$;

-- Un patch solo trae claves conocidas.
create function private.mcp_check_keys(p_changes jsonb, p_allowed text[])
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object'
    or exists (select 1 from jsonb_object_keys(p_changes) k where k <> all (p_allowed)) then
    raise exception 'cambios inválidos' using errcode = 'PL400';
  end if;
  if p_changes ? 'tags' and jsonb_typeof(p_changes -> 'tags') <> 'array' then
    raise exception 'etiquetas inválidas' using errcode = 'PL400';
  end if;
end;
$$;

revoke all on function private.mcp_caller(boolean), private.mcp_audit(uuid, text, uuid),
  private.panel_caller(), private.mcp_own_page(uuid, uuid), private.mcp_check_keys(jsonb, text[])
  from public, anon, authenticated;

-- ── 4. Consentimiento y conexiones (desde el panel) ──────────────────────────
-- Lo llama la Action de `/oauth/consent` al aprobar: crea el grant o lo
-- renueva (una autorización nueva reactiva una conexión revocada).
create function public.mcp_save_grant(
  p_client_id uuid, p_client_name text, p_redirect_host text, p_can_write boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.panel_caller();
begin
  insert into public.mcp_grants (client_id, user_id, client_name, redirect_host, can_write)
  values (p_client_id, v_uid, btrim(p_client_name), lower(p_redirect_host), coalesce(p_can_write, false))
  on conflict (client_id, user_id) do update
  set client_name = excluded.client_name,
      redirect_host = excluded.redirect_host,
      can_write = excluded.can_write,
      revoked_at = null;
end;
$$;

-- Revocar es idempotente: la segunda vez no cambia la fecha. Devuelve si existía.
create function public.mcp_revoke_grant(p_client_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.panel_caller();
begin
  update public.mcp_grants g set revoked_at = coalesce(g.revoked_at, now())
  where g.client_id = p_client_id and g.user_id = v_uid;
  return found;
end;
$$;

-- ── 5. Para el servidor MCP ──────────────────────────────────────────────────
-- Antes de cada tool: ¿la conexión sigue activa? Devuelve si puede escribir.
-- Con `p_write`, además exige el permiso (para lo que no escribe en la base,
-- como "Comprobar ahora").
create function public.mcp_authorize(p_write boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.mcp_caller(p_write);
begin
  return (
    select g.can_write from public.mcp_grants g
    where g.user_id = v_uid and g.client_id = ((select auth.jwt()) ->> 'client_id')::uuid
  );
end;
$$;

-- ── 6. Links ─────────────────────────────────────────────────────────────────
-- Con `p_id`, el alta es idempotente como la del panel: si ya existe un link
-- propio de esa página con ese id, lo devuelve.
create function public.mcp_create_link(
  p_page uuid,
  p_id uuid,
  p_section uuid,
  p_title text,
  p_url text,
  p_description text,
  p_provider public.link_provider,
  p_provider_handle text,
  p_tags text[],
  p_visible boolean
)
returns public.links
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.mcp_caller(true);
  v_link public.links;
begin
  perform private.mcp_own_page(v_uid, p_page);
  insert into public.links (
    id, owner_id, page_id, section_id, title, url, description, provider, provider_handle, tags, visible
  ) values (
    coalesce(p_id, gen_random_uuid()), v_uid, p_page, p_section, p_title, p_url, p_description,
    coalesce(p_provider, 'generic'), p_provider_handle, coalesce(p_tags, '{}'), coalesce(p_visible, true)
  )
  on conflict (id) do nothing
  returning * into v_link;

  if v_link.id is null then
    select * into v_link from public.links l
    where l.id = p_id and l.page_id = p_page and l.owner_id = v_uid;
    if v_link.id is null then
      raise exception 'el id ya está en uso' using errcode = '23505';
    end if;
    return v_link;
  end if;

  perform private.mcp_audit(v_uid, 'create_link', v_link.id);
  return v_link;
end;
$$;

-- Solo cambia las claves presentes en `p_changes`; exige la versión leída.
create function public.mcp_update_link(p_page uuid, p_id uuid, p_version integer, p_changes jsonb)
returns public.links
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.mcp_caller(true);
  v_link public.links;
begin
  perform private.mcp_check_keys(
    p_changes, array['title', 'url', 'description', 'tags', 'visible', 'provider', 'provider_handle']
  );
  update public.links l set
    title = case when p_changes ? 'title' then p_changes ->> 'title' else l.title end,
    url = case when p_changes ? 'url' then p_changes ->> 'url' else l.url end,
    description = case when p_changes ? 'description' then p_changes ->> 'description' else l.description end,
    tags = case when p_changes ? 'tags'
      then array(select jsonb_array_elements_text(p_changes -> 'tags')) else l.tags end,
    visible = case when p_changes ? 'visible' then (p_changes ->> 'visible')::boolean else l.visible end,
    provider = case when p_changes ? 'provider'
      then (p_changes ->> 'provider')::public.link_provider else l.provider end,
    provider_handle = case when p_changes ? 'provider_handle'
      then p_changes ->> 'provider_handle' else l.provider_handle end
  where l.id = p_id and l.page_id = p_page and l.owner_id = v_uid and l.version = p_version
  returning * into v_link;

  if v_link.id is null then
    if exists (select 1 from public.links l where l.id = p_id and l.page_id = p_page and l.owner_id = v_uid) then
      raise exception 'el link cambió' using errcode = 'PL409';
    end if;
    raise exception 'el link no existe' using errcode = 'PL404';
  end if;
  perform private.mcp_audit(v_uid, 'update_link', p_id);
  return v_link;
end;
$$;

-- Borrar exige el título exacto: un pedido ambiguo del agente no borra otra cosa.
create function public.mcp_delete_link(p_page uuid, p_id uuid, p_version integer, p_confirm_title text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.mcp_caller(true);
  v_link public.links;
begin
  select * into v_link from public.links l
  where l.id = p_id and l.page_id = p_page and l.owner_id = v_uid
  for update;
  if v_link.id is null then
    raise exception 'el link no existe' using errcode = 'PL404';
  end if;
  if p_confirm_title is distinct from v_link.title then
    raise exception 'el título no coincide' using errcode = 'PL400';
  end if;
  if v_link.version <> p_version then
    raise exception 'el link cambió' using errcode = 'PL409';
  end if;
  delete from public.links l where l.id = p_id;
  perform private.mcp_audit(v_uid, 'delete_link', p_id);
end;
$$;

-- La misma RPC del panel: comprueba la página por `auth.uid()` y solo toca filas suyas.
create function public.mcp_move_links(
  p_page uuid, p_section uuid, p_ids uuid[], p_versions integer[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.mcp_caller(true);
begin
  perform private.mcp_own_page(v_uid, p_page);
  perform public.move_links(p_page, p_section, p_ids, p_versions);
  perform private.mcp_audit(v_uid, 'move_links', p_section);
end;
$$;

-- ── 7. Secciones ─────────────────────────────────────────────────────────────
create function public.mcp_create_section(
  p_page uuid, p_id uuid, p_title text, p_show_title boolean, p_visible boolean
)
returns public.sections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := private.mcp_caller(true);
  v_section public.sections;
begin
  perform private.mcp_own_page(v_uid, p_page);
  insert into public.sections (id, owner_id, page_id, title, show_title, visible)
  values (coalesce(p_id, gen_random_uuid()), v_uid, p_page, p_title,
          coalesce(p_show_title, true), coalesce(p_visible, true))
  on conflict (id) do nothing
  returning * into v_section;

  if v_section.id is null then
    select * into v_section from public.sections s
    where s.id = p_id and s.page_id = p_page and s.owner_id = v_uid;
    if v_section.id is null then
      raise exception 'el id ya está en uso' using errcode = '23505';
    end if;
    return v_section;
  end if;

  perform private.mcp_audit(v_uid, 'create_section', v_section.id);
  return v_section;
end;
$$;

create function public.mcp_update_section(p_page uuid, p_id uuid, p_version integer, p_changes jsonb)
returns public.sections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := private.mcp_caller(true);
  v_section public.sections;
begin
  perform private.mcp_check_keys(p_changes, array['title', 'show_title', 'visible']);
  update public.sections s set
    title = case when p_changes ? 'title' then p_changes ->> 'title' else s.title end,
    show_title = case when p_changes ? 'show_title'
      then (p_changes ->> 'show_title')::boolean else s.show_title end,
    visible = case when p_changes ? 'visible' then (p_changes ->> 'visible')::boolean else s.visible end
  where s.id = p_id and s.page_id = p_page and s.owner_id = v_uid and s.version = p_version
  returning * into v_section;

  if v_section.id is null then
    if exists (select 1 from public.sections s where s.id = p_id and s.page_id = p_page and s.owner_id = v_uid) then
      raise exception 'la sección cambió' using errcode = 'PL409';
    end if;
    raise exception 'la sección no existe' using errcode = 'PL404';
  end if;
  perform private.mcp_audit(v_uid, 'update_section', p_id);
  return v_section;
end;
$$;

-- Sus links pasan a "Sin sección" (el trigger de siempre).
create function public.mcp_delete_section(
  p_page uuid, p_id uuid, p_version integer, p_confirm_title text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := private.mcp_caller(true);
  v_section public.sections;
begin
  select * into v_section from public.sections s
  where s.id = p_id and s.page_id = p_page and s.owner_id = v_uid
  for update;
  if v_section.id is null then
    raise exception 'la sección no existe' using errcode = 'PL404';
  end if;
  if p_confirm_title is distinct from v_section.title then
    raise exception 'el título no coincide' using errcode = 'PL400';
  end if;
  if v_section.version <> p_version then
    raise exception 'la sección cambió' using errcode = 'PL409';
  end if;
  delete from public.sections s where s.id = p_id;
  perform private.mcp_audit(v_uid, 'delete_section', p_id);
end;
$$;

create function public.mcp_reorder_sections(p_page uuid, p_ids uuid[], p_versions integer[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.mcp_caller(true);
begin
  perform private.mcp_own_page(v_uid, p_page);
  perform public.reorder_sections(p_page, p_ids, p_versions);
  perform private.mcp_audit(v_uid, 'reorder_sections', p_page);
end;
$$;

-- ── 8. Medios del link y página ──────────────────────────────────────────────
-- Upsert de las claves presentes; el trigger de link_media valida que el link
-- admita cada opción (PL400) y fija el dueño.
create function public.mcp_set_link_media(p_link uuid, p_changes jsonb)
returns public.link_media_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.mcp_caller(true);
  v_settings public.link_media_settings;
begin
  perform private.mcp_check_keys(p_changes, array['watch_live', 'featured_mode', 'pinned_video_id']);
  if not exists (select 1 from public.links l where l.id = p_link and l.owner_id = v_uid) then
    raise exception 'el link no existe' using errcode = 'PL404';
  end if;
  insert into public.link_media_settings as m (link_id, owner_id, watch_live, featured_mode, pinned_video_id)
  values (
    p_link, v_uid,
    coalesce((p_changes ->> 'watch_live')::boolean, false),
    coalesce(p_changes ->> 'featured_mode', 'latest_video'),
    p_changes ->> 'pinned_video_id'
  )
  on conflict (link_id) do update set
    watch_live = case when p_changes ? 'watch_live' then excluded.watch_live else m.watch_live end,
    featured_mode = case when p_changes ? 'featured_mode' then excluded.featured_mode else m.featured_mode end,
    pinned_video_id = case when p_changes ? 'pinned_video_id' then excluded.pinned_video_id
      else m.pinned_video_id end
  returning * into v_settings;
  perform private.mcp_audit(v_uid, 'set_link_media', p_link);
  return v_settings;
end;
$$;

-- Nombre visible y bio (el avatar y el tema, no).
create function public.mcp_update_page(p_page uuid, p_changes jsonb)
returns public.pages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.mcp_caller(true);
  v_page public.pages;
begin
  perform private.mcp_check_keys(p_changes, array['display_name', 'bio']);
  update public.pages p set
    display_name = case when p_changes ? 'display_name' then p_changes ->> 'display_name' else p.display_name end,
    bio = case when p_changes ? 'bio' then p_changes ->> 'bio' else p.bio end
  where p.id = p_page and p.owner_id = v_uid
  returning * into v_page;
  if v_page.id is null then
    raise exception 'la página no existe' using errcode = 'PL404';
  end if;
  perform private.mcp_audit(v_uid, 'update_page', p_page);
  return v_page;
end;
$$;

-- ── 9. Privilegios de las funciones ──────────────────────────────────────────
revoke all on function
  public.mcp_save_grant(uuid, text, text, boolean),
  public.mcp_revoke_grant(uuid),
  public.mcp_authorize(boolean),
  public.mcp_create_link(uuid, uuid, uuid, text, text, text, public.link_provider, text, text[], boolean),
  public.mcp_update_link(uuid, uuid, integer, jsonb),
  public.mcp_delete_link(uuid, uuid, integer, text),
  public.mcp_move_links(uuid, uuid, uuid[], integer[]),
  public.mcp_create_section(uuid, uuid, text, boolean, boolean),
  public.mcp_update_section(uuid, uuid, integer, jsonb),
  public.mcp_delete_section(uuid, uuid, integer, text),
  public.mcp_reorder_sections(uuid, uuid[], integer[]),
  public.mcp_set_link_media(uuid, jsonb),
  public.mcp_update_page(uuid, jsonb)
  from public, anon;
grant execute on function
  public.mcp_save_grant(uuid, text, text, boolean),
  public.mcp_revoke_grant(uuid),
  public.mcp_authorize(boolean),
  public.mcp_create_link(uuid, uuid, uuid, text, text, text, public.link_provider, text, text[], boolean),
  public.mcp_update_link(uuid, uuid, integer, jsonb),
  public.mcp_delete_link(uuid, uuid, integer, text),
  public.mcp_move_links(uuid, uuid, uuid[], integer[]),
  public.mcp_create_section(uuid, uuid, text, boolean, boolean),
  public.mcp_update_section(uuid, uuid, integer, jsonb),
  public.mcp_delete_section(uuid, uuid, integer, text),
  public.mcp_reorder_sections(uuid, uuid[], integer[]),
  public.mcp_set_link_media(uuid, jsonb),
  public.mcp_update_page(uuid, jsonb)
  to authenticated;

-- ── 10. Lo que el MCP no puede hacer, tampoco con el token directo ───────────
-- Las funciones de owner (invitar, revocar, listar usuarios) son solo del panel.
create or replace function private.caller_is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select ((select auth.jwt()) ->> 'client_id') is null and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'owner' and not p.disabled
  );
$$;

-- El avatar se sube y se borra solo desde el panel.
drop policy "avatares: cada cuenta sube a su carpeta" on storage.objects;
create policy "avatares: cada cuenta sube a su carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
    and storage.filename(name) ~ '^[0-9a-f-]{36}\.(webp|jpg)$'
    and ((select auth.jwt()) ->> 'client_id') is null
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
    and ((select auth.jwt()) ->> 'client_id') is null
    and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled
    )
  );
