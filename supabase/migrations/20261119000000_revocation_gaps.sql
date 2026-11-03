-- Huecos de revocación (auditoría de seguridad, run 1):
--
-- 1. Una conexión MCP revocada dejaba de entrar por /mcp, pero su access token
--    (vigente hasta `exp`) seguía leyendo lo privado del dueño directo contra
--    PostgREST: la RLS de lectura miraba solo `auth.uid()`. Ahora la rama "del
--    dueño" pide además que el token sea del panel (sin `client_id`) o de una
--    conexión activa. Lo público (visible) se sigue leyendo igual.
-- 2. Una cuenta dada de baja todavía podía subir y borrar en el bucket público
--    `link-previews`: a esas políticas les faltaba el chequeo de `disabled` que
--    los avatares ya tienen.

-- ── 1. ¿El token puede leer como dueño? ──────────────────────────────────────
-- Security definer porque la RLS de `mcp_grants` oculta las filas a un token
-- con `client_id`. Devuelve un booleano sobre el propio token: no expone nada.
-- `anon` también la ejecuta, porque las políticas públicas la evalúan (sin
-- `client_id` siempre da true).
create function public.owner_read_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.jwt()) ->> 'client_id' is null then true
    when (select auth.jwt()) ->> 'client_id' !~ '^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$' then false
    else exists (
      select 1 from public.mcp_grants g
      where g.client_id = ((select auth.jwt()) ->> 'client_id')::uuid
        and g.user_id = (select auth.uid())
        and g.revoked_at is null
    )
  end;
$$;

revoke all on function public.owner_read_allowed() from public;
grant execute on function public.owner_read_allowed() to anon, authenticated;

-- ── 2. Lecturas del dueño: la rama propia exige el token permitido ───────────
drop policy "secciones visibles" on public.sections;
create policy "secciones visibles" on public.sections
  for select to anon, authenticated
  using (
    (owner_id = (select auth.uid()) and (select public.owner_read_allowed()))
    or (visible and exists (select 1 from public.profiles p where p.id = owner_id))
  );

drop policy "links visibles" on public.links;
create policy "links visibles" on public.links
  for select to anon, authenticated
  using (
    (owner_id = (select auth.uid()) and (select public.owner_read_allowed()))
    or (
      visible
      and exists (select 1 from public.profiles p where p.id = owner_id)
      and (
        section_id is null
        or exists (select 1 from public.sections s where s.id = section_id and s.visible)
      )
    )
  );

drop policy "páginas visibles" on public.pages;
create policy "páginas visibles" on public.pages
  for select to anon, authenticated
  using (
    (owner_id = (select auth.uid()) and (select public.owner_read_allowed()))
    or exists (select 1 from public.profiles p where p.id = owner_id)
  );

drop policy "el dueño ve la configuración de sus links" on public.link_media_settings;
create policy "el dueño ve la configuración de sus links" on public.link_media_settings
  for select to authenticated
  using (owner_id = (select auth.uid()) and (select public.owner_read_allowed()));

drop policy "el dueño ve las estadísticas de sus páginas" on public.stats_daily;
create policy "el dueño ve las estadísticas de sus páginas" on public.stats_daily
  for select to authenticated
  using (
    (select public.owner_read_allowed())
    and exists (
      select 1 from public.pages pg where pg.id = page_id and pg.owner_id = (select auth.uid())
    )
  );

drop policy "el dueño ve los clics de sus links" on public.link_stats_daily;
create policy "el dueño ve los clics de sus links" on public.link_stats_daily
  for select to authenticated
  using (
    (select public.owner_read_allowed())
    and exists (
      select 1 from public.links l where l.id = link_id and l.owner_id = (select auth.uid())
    )
  );

drop policy "el dueño ve países y orígenes de sus páginas" on public.stats_breakdown_daily;
create policy "el dueño ve países y orígenes de sus páginas" on public.stats_breakdown_daily
  for select to authenticated
  using (
    (select public.owner_read_allowed())
    and exists (
      select 1 from public.pages pg where pg.id = page_id and pg.owner_id = (select auth.uid())
    )
  );

drop policy "el dueño ve sus preferencias" on public.account_preferences;
create policy "el dueño ve sus preferencias" on public.account_preferences
  for select to authenticated
  using (user_id = (select auth.uid()) and (select public.owner_read_allowed()));

-- ── 3. link-previews: una cuenta dada de baja tampoco escribe acá ────────────
drop policy "vistas previas: cada cuenta sube a su carpeta" on storage.objects;
create policy "vistas previas: cada cuenta sube a su carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'link-previews'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
    and storage.filename(name) ~ '^[0-9a-f-]{36}\.(webp|jpg)$'
    and ((select auth.jwt()) ->> 'client_id') is null
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
  );

drop policy "vistas previas: cada cuenta borra de su carpeta" on storage.objects;
create policy "vistas previas: cada cuenta borra de su carpeta" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'link-previews'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and ((select auth.jwt()) ->> 'client_id') is null
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
  );
