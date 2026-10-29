-- Links destacados (tarea 36e, SPEC-appearance "Entrega 6b").
--
-- `accent`: el link queda en su lugar, con borde y fondo suave del acento.
-- `top`: va arriba de todo, en tarjeta, y no se repite en su sección. Puede
-- haber varios destacados; arriba de todo, hasta 3 por página (lo valida la
-- base, con el mismo error de límite que el resto).

create type public.link_highlight as enum ('none', 'accent', 'top');

alter table public.links
  add column highlight public.link_highlight not null default 'none';

-- Como el lugar: lo cambia el dueño desde el panel.
grant update (highlight) on public.links to authenticated;

create function public.limit_top_links()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.highlight = 'top' and (tg_op = 'INSERT' or old.highlight is distinct from 'top') then
    -- Dos pedidos a la vez no pueden pasar los dos el conteo.
    perform pg_advisory_xact_lock(hashtextextended('top-links:' || new.page_id::text, 0));
    if (select count(*) from public.links l
        where l.page_id = new.page_id and l.highlight = 'top' and l.id <> new.id) >= 3 then
      raise exception 'hasta 3 links arriba de todo' using errcode = 'PL429';
    end if;
  end if;
  return new;
end;
$$;

create trigger links_limit_top before insert or update of highlight on public.links
  for each row execute function public.limit_top_links();

-- Cada link de la vista pública suma su destacado (las columnas de la vista no cambian).
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
                  'highlight', l.highlight
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
                  'highlight', l.highlight
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
