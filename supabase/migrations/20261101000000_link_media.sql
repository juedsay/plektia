-- Configuración de medios por link (tarea 24, SPEC-live-status): "Transmito en
-- este canal" y el contenido destacado de YouTube. La escribe el dueño desde el
-- panel; el refresco (tareas 25 y 26) solo la lee.
--
-- Sin fila, el link usa lo predeterminado: no se vigila y destaca el último
-- video. El panel guarda el estado completo (upsert): repetir el pedido deja
-- lo mismo.

create table public.link_media_settings (
  link_id          uuid primary key references public.links (id) on delete cascade,
  -- Lo fija el trigger con el dueño del link: nadie lo elige.
  owner_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  watch_live       boolean not null default false,
  featured_mode    text not null default 'latest_video'
                   check (featured_mode in ('none', 'latest_video', 'latest_short', 'latest_stream', 'pinned')),
  pinned_video_id  text check (pinned_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  updated_at       timestamptz not null default now(),
  check (featured_mode <> 'pinned' or pinned_video_id is not null)
);

create index link_media_settings_owner on public.link_media_settings (owner_id);
create index link_media_settings_watched on public.link_media_settings (link_id) where watch_live;

alter table public.link_media_settings enable row level security;

-- ── Privilegios ──────────────────────────────────────────────────────────────
revoke all on public.link_media_settings from anon, authenticated;
grant select on public.link_media_settings to authenticated;
grant insert (link_id, watch_live, featured_mode, pinned_video_id)
  on public.link_media_settings to authenticated;
-- `link_id` también: el upsert de PostgREST lo repite en el `set`. Aunque se
-- cambiara, el trigger vuelve a sacar el dueño del link y la RLS lo exige.
grant update (link_id, watch_live, featured_mode, pinned_video_id)
  on public.link_media_settings to authenticated;
grant delete on public.link_media_settings to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Solo el dueño la ve y la cambia, con su perfil activo y desde el panel (los
-- clientes MCP escriben por funciones `mcp_*`, SPEC-mcp-server).
create policy "el dueño ve la configuración de sus links" on public.link_media_settings
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "el dueño configura sus links" on public.link_media_settings
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
    and ((select auth.jwt()) ->> 'client_id') is null
  );

create policy "el dueño cambia la configuración de sus links" on public.link_media_settings
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
    and ((select auth.jwt()) ->> 'client_id') is null
  )
  with check (owner_id = (select auth.uid()));

create policy "el dueño borra la configuración de sus links" on public.link_media_settings
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
    and ((select auth.jwt()) ->> 'client_id') is null
  );

-- ── Cada opción, solo donde tiene sentido ────────────────────────────────────
-- El dueño sale del link (la RLS rechaza después el link de otro). Vigilar
-- pide un canal de YouTube, Twitch o Kick; destacar algo que no sea lo
-- predeterminado pide un canal de YouTube.
create function private.prepare_link_media_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.links;
begin
  select * into v_link from public.links l where l.id = new.link_id;
  if not found then
    raise exception 'el link no existe' using errcode = 'PL404';
  end if;

  new.owner_id := v_link.owner_id;
  new.updated_at := now();
  if new.featured_mode <> 'pinned' then
    new.pinned_video_id := null;
  end if;

  if new.watch_live and (
    v_link.provider not in ('youtube', 'twitch', 'kick') or v_link.provider_handle is null
  ) then
    raise exception 'ese link no es un canal que se pueda vigilar' using errcode = 'PL400';
  end if;
  if new.featured_mode <> 'latest_video' and (
    v_link.provider <> 'youtube' or v_link.provider_handle is null
  ) then
    raise exception 'el contenido destacado es solo para canales de YouTube' using errcode = 'PL400';
  end if;
  return new;
end;
$$;

revoke all on function private.prepare_link_media_settings() from public, anon, authenticated;

create trigger link_media_settings_prepare
  before insert or update on public.link_media_settings
  for each row execute function private.prepare_link_media_settings();

-- Si el link pasa a ser de otro proveedor, o deja de apuntar a un canal, su
-- configuración ya no aplica.
create function private.reset_link_media_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.link_media_settings m where m.link_id = new.id;
  return new;
end;
$$;

revoke all on function private.reset_link_media_settings() from public, anon, authenticated;

create trigger links_reset_media_settings
  after update of provider, provider_handle on public.links
  for each row
  when (
    old.provider is distinct from new.provider
    or (old.provider_handle is not null and new.provider_handle is null)
  )
  execute function private.reset_link_media_settings();
