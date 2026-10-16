-- Links (SPEC-links, tarea 11): secciones y links con RLS, orden atómico y límites.
--
-- Errores propios (SQLSTATE) que los casos de uso traducen a su error de dominio:
--   PL400 invalid_input · PL404 not_found · PL409 conflict · PL429 limit_reached

-- ── Tablas ───────────────────────────────────────────────────────────────────
create table public.sections (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null check (
    char_length(btrim(title)) between 1 and 40 and title !~ '[[:cntrl:]]'
  ),
  show_title  boolean not null default true,
  visible     boolean not null default true,
  position    integer not null default 0 check (position >= 0),
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Diferida: dentro de una transacción se puede reordenar pasando por estados
  -- intermedios con posiciones repetidas; al confirmar, no puede haber ninguna.
  constraint sections_unique_position unique (owner_id, position) deferrable initially deferred
);

create type public.link_provider as enum
  ('generic', 'youtube', 'twitch', 'kick', 'whatsapp', 'github', 'instagram');

create table public.links (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  section_id       uuid references public.sections (id) on delete set null,
  title            text not null check (
    char_length(btrim(title)) between 1 and 80 and title !~ '[[:cntrl:]]'
  ),
  -- Las mismas reglas que parseSafeUrl, por si alguien escribe sin pasar por la app.
  url              text not null check (
    char_length(url) <= 2048
    and url ~ '^(https://[^/?#@]+([/?#].*)?|mailto:[^@]+@.+)$'
    and url !~ '[[:cntrl:][:space:]]'
  ),
  description      text check (char_length(description) <= 120 and description !~ '[[:cntrl:]]'),
  provider         public.link_provider not null default 'generic',
  provider_handle  text check (char_length(provider_handle) <= 100),
  tags             text[] not null default '{}' check (
    cardinality(tags) <= 5
    and array_to_string(tags, ',') ~ '^([a-z0-9-]{1,24}(,[a-z0-9-]{1,24})*)?$'
  ),
  visible          boolean not null default true,
  position         integer not null default 0 check (position >= 0),
  version          integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Posición única por grupo (cada sección, y "Sin sección" de cada dueño).
  -- Un índice único parcial no puede ser diferido; una restricción de exclusión sí.
  constraint links_unique_position_in_section
    exclude using btree (section_id with =, position with =)
    where (section_id is not null) deferrable initially deferred,
  constraint links_unique_position_unsectioned
    exclude using btree (owner_id with =, position with =)
    where (section_id is null) deferrable initially deferred
);

create index links_owner_section_position on public.links (owner_id, section_id, position);
create index links_live_targets on public.links (provider, provider_handle)
  where provider in ('youtube', 'twitch', 'kick');
create index sections_owner_position on public.sections (owner_id, position);

alter table public.sections enable row level security;
alter table public.links enable row level security;

-- ── Privilegios ──────────────────────────────────────────────────────────────
-- Por columna: nadie cambia `id`, `owner_id`, `version` ni las fechas. La
-- posición al crear la pone un trigger; reordenar va por las RPC de abajo.
revoke all on public.sections, public.links from anon, authenticated;
grant select on public.sections, public.links to anon, authenticated;
grant insert (owner_id, title, show_title, visible) on public.sections to authenticated;
grant update (title, show_title, visible, position) on public.sections to authenticated;
grant delete on public.sections to authenticated;
grant insert (owner_id, section_id, title, url, description, provider, provider_handle, tags, visible)
  on public.links to authenticated;
grant update (section_id, title, url, description, provider, provider_handle, tags, visible, position)
  on public.links to authenticated;
grant delete on public.links to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Escribe el dueño, si su perfil está activo y desde el panel: los clientes MCP
-- (JWT con `client_id`) escriben por funciones `mcp_*` acotadas (SPEC-mcp-server).
-- Se lee lo visible de perfiles activos (la RLS de `profiles` oculta los dados
-- de baja), y el dueño ve todo lo suyo.

create policy "secciones visibles" on public.sections
  for select to anon, authenticated
  using (
    owner_id = (select auth.uid())
    or (visible and exists (select 1 from public.profiles p where p.id = owner_id))
  );

create policy "el dueño crea sus secciones" on public.sections
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
    and ((select auth.jwt()) ->> 'client_id') is null
  );

create policy "el dueño edita sus secciones" on public.sections
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
    and ((select auth.jwt()) ->> 'client_id') is null
  )
  with check (owner_id = (select auth.uid()));

create policy "el dueño borra sus secciones" on public.sections
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
    and ((select auth.jwt()) ->> 'client_id') is null
  );

create policy "links visibles" on public.links
  for select to anon, authenticated
  using (
    owner_id = (select auth.uid())
    or (
      visible
      and exists (select 1 from public.profiles p where p.id = owner_id)
      and (
        section_id is null
        or exists (select 1 from public.sections s where s.id = section_id and s.visible)
      )
    )
  );

create policy "el dueño crea sus links" on public.links
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
    and ((select auth.jwt()) ->> 'client_id') is null
  );

create policy "el dueño edita sus links" on public.links
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
    and ((select auth.jwt()) ->> 'client_id') is null
  )
  with check (owner_id = (select auth.uid()));

create policy "el dueño borra sus links" on public.links
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
    and ((select auth.jwt()) ->> 'client_id') is null
  );

-- ── Triggers ─────────────────────────────────────────────────────────────────
-- Funciones `security invoker` en `public`: se ejecutan con los permisos (y la
-- RLS) de quien escribe. `private` no es alcanzable por los roles de la API.

-- Versión y fecha en cada cambio: el caso de uso actualiza con
-- `where version = <la leída>`; si no cambia ninguna fila, es un conflicto.
create function public.bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger sections_bump_version before update on public.sections
  for each row execute function public.bump_version();
create trigger links_bump_version before update on public.links
  for each row execute function public.bump_version();

-- Alta de una sección: límite por usuario y posición al final. El lock por
-- dueño serializa las altas simultáneas (sin él, dos podrían pasar el límite
-- o tomar la misma posición).
create function public.place_new_section()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('sections:' || new.owner_id::text, 0));
  if (select count(*) from public.sections s where s.owner_id = new.owner_id) >= 30 then
    raise exception 'límite de 30 secciones' using errcode = 'PL429';
  end if;
  new.position := coalesce(
    (select max(s.position) + 1 from public.sections s where s.owner_id = new.owner_id), 0
  );
  return new;
end;
$$;

create trigger sections_place_new before insert on public.sections
  for each row execute function public.place_new_section();

-- Alta de un link: límite, sección del mismo dueño y posición al final del grupo.
create function public.place_new_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('links:' || new.owner_id::text, 0));
  if (select count(*) from public.links l where l.owner_id = new.owner_id) >= 200 then
    raise exception 'límite de 200 links' using errcode = 'PL429';
  end if;
  new.position := coalesce(
    (select max(l.position) + 1 from public.links l
      where l.owner_id = new.owner_id and l.section_id is not distinct from new.section_id),
    0
  );
  return new;
end;
$$;

create trigger links_place_new before insert on public.links
  for each row execute function public.place_new_link();

-- La RLS no alcanza: la fila es del usuario, pero la sección a la que apunta
-- podría ser de otro. Se valida en cada alta y en cada cambio de sección.
create function public.check_link_section_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.section_id is not null and not exists (
    select 1 from public.sections s where s.id = new.section_id and s.owner_id = new.owner_id
  ) then
    raise exception 'la sección no existe o es de otro usuario' using errcode = 'PL404';
  end if;
  return new;
end;
$$;

create trigger links_check_section_owner before insert or update of section_id on public.links
  for each row execute function public.check_link_section_owner();

-- Al borrar una sección, sus links pasan al final de "Sin sección", en su orden.
-- Se hace antes del borrado: después, la FK ya los habría dejado sin sección y
-- no se sabría cuáles eran.
create function public.unsection_links_of_deleted_section()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base integer;
begin
  select coalesce(max(l.position) + 1, 0) into base
  from public.links l
  where l.owner_id = old.owner_id and l.section_id is null;

  update public.links l
  set section_id = null, position = base + ordered.rank - 1
  from (
    select x.id, row_number() over (order by x.position) as rank
    from public.links x
    where x.section_id = old.id
  ) ordered
  where l.id = ordered.id;
  return old;
end;
$$;

create trigger sections_unsection_links before delete on public.sections
  for each row execute function public.unsection_links_of_deleted_section();

-- ── Orden atómico (RPC) ──────────────────────────────────────────────────────
-- `security invoker`: corren con la RLS de quien llama. Reciben el orden final
-- completo y las versiones leídas; si algo no coincide, no cambian nada.

create function public.reorder_sections(ids uuid[], expected_versions integer[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  if cardinality(ids) is distinct from cardinality(expected_versions)
    or cardinality(ids) <> (select count(distinct x) from unnest(ids) x) then
    raise exception 'lista inválida' using errcode = 'PL400';
  end if;

  -- Bloquea las secciones del usuario para que nadie las cambie en el medio.
  perform 1 from public.sections s where s.owner_id = uid for update;

  -- La lista tiene que ser exactamente el conjunto de secciones del usuario.
  if (select count(*) from public.sections s where s.owner_id = uid) <> cardinality(ids)
    or exists (
      select 1 from unnest(ids) x
      where not exists (select 1 from public.sections s where s.id = x and s.owner_id = uid)
    ) then
    raise exception 'la lista no coincide con tus secciones' using errcode = 'PL400';
  end if;

  if exists (
    select 1 from unnest(ids, expected_versions) as t(id, version)
    join public.sections s on s.id = t.id
    where s.version <> t.version
  ) then
    raise exception 'las secciones cambiaron' using errcode = 'PL409';
  end if;

  update public.sections s
  set position = t.ord - 1
  from unnest(ids) with ordinality as t(id, ord)
  where s.id = t.id and s.position <> t.ord - 1;
end;
$$;

-- Ordena un grupo (una sección o "Sin sección") y trae a él los links de otros
-- grupos que estén en la lista. `ids` es el orden final completo del grupo.
create function public.move_links(target_section uuid, ids uuid[], expected_versions integer[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sources uuid[];
  source uuid;
begin
  if uid is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  if cardinality(ids) is distinct from cardinality(expected_versions)
    or cardinality(ids) <> (select count(distinct x) from unnest(ids) x) then
    raise exception 'lista inválida' using errcode = 'PL400';
  end if;
  if target_section is not null and not exists (
    select 1 from public.sections s where s.id = target_section and s.owner_id = uid
  ) then
    raise exception 'la sección no existe o es de otro usuario' using errcode = 'PL404';
  end if;

  perform 1 from public.links l where l.owner_id = uid for update;

  -- Todos los links de la lista son del usuario…
  if exists (
    select 1 from unnest(ids) x
    where not exists (select 1 from public.links l where l.id = x and l.owner_id = uid)
  ) then
    raise exception 'la lista tiene links que no son tuyos' using errcode = 'PL400';
  end if;
  -- …y el grupo destino no pierde ninguno: la lista es su orden final completo.
  if exists (
    select 1 from public.links l
    where l.owner_id = uid and l.section_id is not distinct from target_section
      and l.id <> all (ids)
  ) then
    raise exception 'la lista no incluye todos los links del grupo' using errcode = 'PL400';
  end if;

  if exists (
    select 1 from unnest(ids, expected_versions) as t(id, version)
    join public.links l on l.id = t.id
    where l.version <> t.version
  ) then
    raise exception 'los links cambiaron' using errcode = 'PL409';
  end if;

  select array_agg(distinct l.section_id) filter (where l.section_id is distinct from target_section)
  into sources
  from public.links l
  where l.id = any (ids);

  update public.links l
  set section_id = target_section, position = t.ord - 1
  from unnest(ids) with ordinality as t(id, ord)
  where l.id = t.id;

  -- Los grupos de origen quedan compactos (0, 1, 2…) en su orden.
  foreach source in array coalesce(sources, '{}') loop
    update public.links l
    set position = ordered.rank - 1
    from (
      select x.id, row_number() over (order by x.position) as rank
      from public.links x
      where x.owner_id = uid and x.section_id is not distinct from source
    ) ordered
    where l.id = ordered.id and l.position <> ordered.rank - 1;
  end loop;
end;
$$;

revoke execute on function public.reorder_sections(uuid[], integer[]) from public, anon;
revoke execute on function public.move_links(uuid, uuid[], integer[]) from public, anon;
grant execute on function public.reorder_sections(uuid[], integer[]) to authenticated;
grant execute on function public.move_links(uuid, uuid[], integer[]) to authenticated;

-- Las funciones de trigger no se llaman directo desde la API.
revoke execute on function public.bump_version(), public.place_new_section(),
  public.place_new_link(), public.check_link_section_owner(),
  public.unsection_links_of_deleted_section() from public, anon, authenticated;
