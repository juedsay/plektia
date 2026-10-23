-- Páginas (SPEC-pages, tarea 17c): una cuenta tiene hasta 3 páginas, cada una con
-- su handle, su presentación, sus secciones y sus links. `profiles` queda para
-- la persona (rol, baja y última página usada).
--
-- Migración sin cambios visibles: cada perfil pasa a ser una página con el
-- mismo id, así `page_id` se completa con el `owner_id` que ya existe.

-- ── 1. Tabla de páginas ─────────────────────────────────────────────────────
create table public.pages (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  handle       public.handle not null unique,
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio          text check (char_length(bio) <= 160),
  -- Ruta en Supabase Storage: `{owner_id}/{uuid}.webp` (la subida es de admin-panel).
  avatar_path  text check (avatar_path ~ ('^' || owner_id::text || '/[0-9a-f-]{36}\.webp$')),
  theme        public.profile_theme not null default 'tecnico',
  show_handle  boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index pages_owner_created on public.pages (owner_id, created_at);

insert into public.pages (
  id, owner_id, handle, display_name, bio, avatar_path, theme, show_handle, created_at, updated_at
)
select id, id, handle, display_name, bio, avatar_path, theme, show_handle, created_at, updated_at
from public.profiles;

-- ── 2. Secciones y links pasan a ser de una página ──────────────────────────
-- Sin tocar versiones ni fechas: completar `page_id` no es una edición.
alter table public.sections disable trigger sections_bump_version;
alter table public.links disable trigger links_bump_version;

alter table public.sections add column page_id uuid references public.pages (id) on delete cascade;
alter table public.links add column page_id uuid references public.pages (id) on delete cascade;
update public.sections set page_id = owner_id;
update public.links set page_id = owner_id;
alter table public.sections alter column page_id set not null;
alter table public.links alter column page_id set not null;

alter table public.sections enable trigger sections_bump_version;
alter table public.links enable trigger links_bump_version;

-- Posiciones únicas por página (antes, por dueño).
alter table public.sections drop constraint sections_unique_position;
alter table public.sections
  add constraint sections_unique_position unique (page_id, position) deferrable initially deferred;
alter table public.links drop constraint links_unique_position_unsectioned;
alter table public.links
  add constraint links_unique_position_unsectioned
  exclude using btree (page_id with =, position with =)
  where (section_id is null) deferrable initially deferred;

drop index public.links_owner_section_position;
drop index public.sections_owner_position;
create index links_page_section_position on public.links (page_id, section_id, position);
create index sections_page_position on public.sections (page_id, position);

-- `page_id` se elige al crear y no se cambia después (mover entre páginas no existe).
revoke insert on public.sections, public.links from authenticated;
grant insert (owner_id, page_id, title, show_title, visible) on public.sections to authenticated;
grant insert (owner_id, page_id, section_id, title, url, description, provider, provider_handle, tags, visible)
  on public.links to authenticated;

-- La RLS mira `owner_id`; este trigger garantiza que la página sea del mismo
-- dueño (si no, alguien podría colgar cosas en la página de otro).
create function public.check_page_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.pages p where p.id = new.page_id and p.owner_id = new.owner_id
  ) then
    raise exception 'la página no existe o es de otro usuario' using errcode = 'PL404';
  end if;
  return new;
end;
$$;

create trigger sections_check_page_owner before insert on public.sections
  for each row execute function public.check_page_owner();
create trigger links_check_page_owner before insert on public.links
  for each row execute function public.check_page_owner();

-- Límites y posición al final, por página. El lock por página serializa las
-- altas simultáneas.
create or replace function public.place_new_section()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('sections:' || new.page_id::text, 0));
  if (select count(*) from public.sections s where s.page_id = new.page_id) >= 30 then
    raise exception 'límite de 30 secciones' using errcode = 'PL429';
  end if;
  new.position := coalesce(
    (select max(s.position) + 1 from public.sections s where s.page_id = new.page_id), 0
  );
  return new;
end;
$$;

create or replace function public.place_new_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('links:' || new.page_id::text, 0));
  if (select count(*) from public.links l where l.page_id = new.page_id) >= 200 then
    raise exception 'límite de 200 links' using errcode = 'PL429';
  end if;
  new.position := coalesce(
    (select max(l.position) + 1 from public.links l
      where l.page_id = new.page_id and l.section_id is not distinct from new.section_id),
    0
  );
  return new;
end;
$$;

-- La sección de un link tiene que ser del mismo dueño y de la misma página.
create or replace function public.check_link_section_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.section_id is not null and not exists (
    select 1 from public.sections s
    where s.id = new.section_id and s.owner_id = new.owner_id and s.page_id = new.page_id
  ) then
    raise exception 'la sección no existe o es de otro usuario' using errcode = 'PL404';
  end if;
  return new;
end;
$$;

create or replace function public.unsection_links_of_deleted_section()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base integer;
begin
  select coalesce(max(l.position) + 1, 0) into base
  from public.links l
  where l.page_id = old.page_id and l.section_id is null;

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

-- ── 3. Orden atómico por página (RPC) ───────────────────────────────────────
drop function public.reorder_sections(uuid[], integer[]);
drop function public.move_links(uuid, uuid[], integer[]);

create function public.reorder_sections(target_page uuid, ids uuid[], expected_versions integer[])
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
  if not exists (select 1 from public.pages p where p.id = target_page and p.owner_id = uid) then
    raise exception 'la página no existe o es de otro usuario' using errcode = 'PL404';
  end if;
  if cardinality(ids) is distinct from cardinality(expected_versions)
    or cardinality(ids) <> (select count(distinct x) from unnest(ids) x) then
    raise exception 'lista inválida' using errcode = 'PL400';
  end if;

  perform 1 from public.sections s where s.page_id = target_page for update;

  -- La lista tiene que ser exactamente el conjunto de secciones de la página.
  if (select count(*) from public.sections s where s.page_id = target_page) <> cardinality(ids)
    or exists (
      select 1 from unnest(ids) x
      where not exists (
        select 1 from public.sections s where s.id = x and s.page_id = target_page
      )
    ) then
    raise exception 'la lista no coincide con las secciones de la página' using errcode = 'PL400';
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

-- Ordena un grupo de la página (una sección o "Sin sección") y trae a él los
-- links de otros grupos de la misma página que estén en la lista.
create function public.move_links(
  target_page uuid, target_section uuid, ids uuid[], expected_versions integer[]
)
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
  if not exists (select 1 from public.pages p where p.id = target_page and p.owner_id = uid) then
    raise exception 'la página no existe o es de otro usuario' using errcode = 'PL404';
  end if;
  if cardinality(ids) is distinct from cardinality(expected_versions)
    or cardinality(ids) <> (select count(distinct x) from unnest(ids) x) then
    raise exception 'lista inválida' using errcode = 'PL400';
  end if;
  if target_section is not null and not exists (
    select 1 from public.sections s where s.id = target_section and s.page_id = target_page
  ) then
    raise exception 'la sección no existe o es de otra página' using errcode = 'PL404';
  end if;

  perform 1 from public.links l where l.page_id = target_page for update;

  -- Todos los links de la lista son de la página…
  if exists (
    select 1 from unnest(ids) x
    where not exists (select 1 from public.links l where l.id = x and l.page_id = target_page)
  ) then
    raise exception 'la lista tiene links que no son de la página' using errcode = 'PL400';
  end if;
  -- …y el grupo destino no pierde ninguno: la lista es su orden final completo.
  if exists (
    select 1 from public.links l
    where l.page_id = target_page and l.section_id is not distinct from target_section
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
      where x.page_id = target_page and x.section_id is not distinct from source
    ) ordered
    where l.id = ordered.id and l.position <> ordered.rank - 1;
  end loop;
end;
$$;

revoke execute on function public.reorder_sections(uuid, uuid[], integer[]) from public, anon;
revoke execute on function public.move_links(uuid, uuid, uuid[], integer[]) from public, anon;
grant execute on function public.reorder_sections(uuid, uuid[], integer[]) to authenticated;
grant execute on function public.move_links(uuid, uuid, uuid[], integer[]) to authenticated;

-- ── 4. Reglas de las páginas ────────────────────────────────────────────────
alter table public.pages enable row level security;

revoke all on public.pages from anon, authenticated;
grant select on public.pages to anon, authenticated;
grant insert (owner_id, handle, display_name, bio, theme, show_handle) on public.pages to authenticated;
-- El handle y el dueño no se cambian; el avatar lo sube admin-panel.
grant update (display_name, bio, theme, show_handle) on public.pages to authenticated;
grant delete on public.pages to authenticated;
-- El check del dominio `handle` llama a esta función con los permisos de quien
-- inserta: antes solo la usaba el alta (security definer); ahora el dueño crea
-- páginas. Es inmutable y solo compara con una lista fija.
grant execute on function private.is_reserved_handle(text) to authenticated;

-- Se lee la página de una cuenta activa (la RLS de `profiles` oculta las dadas
-- de baja), y el dueño ve las suyas siempre.
create policy "páginas visibles" on public.pages
  for select to anon, authenticated
  using (
    owner_id = (select auth.uid())
    or exists (select 1 from public.profiles p where p.id = owner_id)
  );

create policy "el dueño crea sus páginas" on public.pages
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
    and ((select auth.jwt()) ->> 'client_id') is null
  );

create policy "el dueño edita sus páginas" on public.pages
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
    and ((select auth.jwt()) ->> 'client_id') is null
  )
  with check (owner_id = (select auth.uid()));

create policy "el dueño borra sus páginas" on public.pages
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
    and ((select auth.jwt()) ->> 'client_id') is null
  );

create trigger pages_touch_updated_at
  before update on public.pages
  for each row execute function private.touch_updated_at();

-- Hasta 3 páginas por cuenta (SPEC-pages). El lock por dueño serializa las
-- altas simultáneas: sin él, dos podrían pasar el límite.
create function public.check_page_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('pages:' || new.owner_id::text, 0));
  if (select count(*) from public.pages p where p.owner_id = new.owner_id) >= 3 then
    raise exception 'límite de 3 páginas' using errcode = 'PL429';
  end if;
  return new;
end;
$$;

create trigger pages_check_limit before insert on public.pages
  for each row execute function public.check_page_limit();

-- Una cuenta siempre tiene al menos una página. Si se está borrando la cuenta
-- entera (el perfil ya no existe), sus páginas se van con ella.
create function public.keep_last_page()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles p where p.id = old.owner_id)
    and (select count(*) from public.pages p where p.owner_id = old.owner_id) <= 1 then
    raise exception 'no se puede borrar la única página' using errcode = 'PL409';
  end if;
  return old;
end;
$$;

create trigger pages_keep_last before delete on public.pages
  for each row execute function public.keep_last_page();

-- ── 5. Perfil: la persona y su última página usada ──────────────────────────
alter table public.profiles
  add column last_page_id uuid references public.pages (id) on delete set null;
grant update (last_page_id) on public.profiles to authenticated;

create function public.check_last_page_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.last_page_id is not null and not exists (
    select 1 from public.pages p where p.id = new.last_page_id and p.owner_id = new.id
  ) then
    raise exception 'la página no existe o es de otro usuario' using errcode = 'PL404';
  end if;
  return new;
end;
$$;

create trigger profiles_check_last_page before update of last_page_id on public.profiles
  for each row execute function public.check_last_page_owner();

-- ── 6. Vista pública desde las páginas ──────────────────────────────────────
-- Mismas columnas que antes: la página pública no cambia.
drop view public.public_page_v;

create view public.public_page_v
with (security_invoker = true)
as
select
  pg.handle,
  pg.display_name,
  pg.bio,
  pg.avatar_path,
  pg.theme,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'showTitle', s.show_title,
          'links', coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', l.id,
                  'title', l.title,
                  'url', l.url,
                  'description', l.description,
                  'provider', l.provider,
                  'providerHandle', l.provider_handle
                )
                order by l.position
              )
              from public.links l
              where l.section_id = s.id and l.visible
            ),
            '[]'::jsonb
          )
        )
        order by s.position
      )
      from public.sections s
      where s.page_id = pg.id and s.visible
    ),
    '[]'::jsonb
  ) as sections,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'url', l.url,
          'description', l.description,
          'provider', l.provider,
          'providerHandle', l.provider_handle
        )
        order by l.position
      )
      from public.links l
      where l.page_id = pg.id and l.section_id is null and l.visible
    ),
    '[]'::jsonb
  ) as unsectioned_links,
  pg.show_handle
from public.pages pg
join public.profiles pr on pr.id = pg.owner_id
where not pr.disabled;

revoke all on public.public_page_v from anon, authenticated;
grant select on public.public_page_v to anon, authenticated;

-- ── 7. Alta de cuenta: perfil y primera página ──────────────────────────────
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
  where a.email::text = lower(trim(new.email));

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

-- ── 8. Los handles ahora viven en las páginas ───────────────────────────────
create or replace function private.assert_no_reserved_handles_in_use()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_taken text;
begin
  select string_agg(handle, ', ' order by handle) into v_taken
  from (
    select p.handle::text as handle from public.pages p
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

-- La presentación ya está en `pages`: se saca de `profiles`.
alter table public.profiles
  drop column handle,
  drop column display_name,
  drop column bio,
  drop column avatar_path,
  drop column theme,
  drop column show_handle;

-- Las funciones de trigger no se llaman directo desde la API.
revoke execute on function public.check_page_owner(), public.check_page_limit(),
  public.keep_last_page(), public.check_last_page_owner() from public, anon, authenticated;
revoke execute on function private.assert_no_reserved_handles_in_use() from public, anon, authenticated;

select private.assert_no_reserved_handles_in_use();
