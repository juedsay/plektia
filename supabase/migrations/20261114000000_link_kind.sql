-- Tipo de link (tarea 37b, SPEC-link-form "Entrega 7b").
--
-- Red social, artículo, video o sitio. `null` es "automático": la página lo
-- deduce de la URL al mostrarlo (src/ui/view/link-kind.ts), así los links que
-- ya existían no necesitan rellenarse y la detección vive en un solo lugar. La
-- base guarda solo lo que el dueño eligió a mano.

create type public.link_kind as enum ('social', 'article', 'video', 'site');

alter table public.links add column kind public.link_kind;

grant insert (kind), update (kind) on public.links to authenticated;

-- MCP: crear con un tipo opcional (cambia la firma) y cambiarlo en update_link.
drop function public.mcp_create_link(uuid, uuid, uuid, text, text, text, public.link_provider, text, text[], boolean);

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
  p_visible boolean,
  p_kind public.link_kind default null
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
    id, owner_id, page_id, section_id, title, url, description, provider, provider_handle, tags, visible,
    kind
  ) values (
    coalesce(p_id, gen_random_uuid()), v_uid, p_page, p_section, p_title, p_url, p_description,
    coalesce(p_provider, 'generic'), p_provider_handle, coalesce(p_tags, '{}'), coalesce(p_visible, true),
    p_kind
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

revoke all on function public.mcp_create_link(uuid, uuid, uuid, text, text, text, public.link_provider, text, text[], boolean, public.link_kind) from public, anon;
grant execute on function public.mcp_create_link(uuid, uuid, uuid, text, text, text, public.link_provider, text, text[], boolean, public.link_kind) to authenticated;

create or replace function public.mcp_update_link(p_page uuid, p_id uuid, p_version integer, p_changes jsonb)
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
    p_changes, array['title', 'url', 'description', 'tags', 'visible', 'provider', 'provider_handle', 'kind']
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
      then p_changes ->> 'provider_handle' else l.provider_handle end,
    kind = case when p_changes ? 'kind'
      then (p_changes ->> 'kind')::public.link_kind else l.kind end
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

-- Cada link de la vista pública suma su tipo (las columnas de la vista no cambian).
create or replace view public.public_page_v
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
                  'providerHandle', l.provider_handle,
                  'featured', public.link_featured(l.id),
                  'live', public.link_live(l.id),
                  'placement', l.placement,
                  'highlight', l.highlight,
                  'kind', l.kind
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
          'providerHandle', l.provider_handle,
          'featured', public.link_featured(l.id),
                  'live', public.link_live(l.id),
                  'placement', l.placement,
                  'highlight', l.highlight,
                  'kind', l.kind
        )
        order by l.position
      )
      from public.links l
      where l.page_id = pg.id and l.section_id is null and l.visible
    ),
    '[]'::jsonb
  ) as unsectioned_links,
  pg.show_handle,
  pg.color_mode,
  pg.accent,
  pg.link_shape,
  pg.name_font
from public.pages pg
join public.profiles pr on pr.id = pg.owner_id
where not pr.disabled;

revoke all on public.public_page_v from anon, authenticated;
grant select on public.public_page_v to anon, authenticated;
