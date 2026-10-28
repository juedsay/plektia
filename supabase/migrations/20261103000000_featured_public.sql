-- Contenido destacado en la página pública (tarea 25c, SPEC-live-status,
-- historia 4). La vista suma `featured` a cada link de YouTube; la miniatura la
-- sirve el propio sitio (`/thumbs/{id}.jpg`), así la página no le pide nada a
-- otro dominio.

-- ── 0. `thumbs` pasa a ser una ruta propia: nadie puede usarla de handle ─────
-- La misma lista que `src/domain/handle.ts` (sin el handle oficial).
create or replace function private.is_reserved_handle(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(value) = any (array[
    '_astro', '.well-known', 'about', 'admin', 'api', 'app', 'assets', 'auth',
    'avatars', 'contact', 'contacto', 'favicon.ico', 'help', 'legal', 'login',
    'logout', 'mcp', 'new', 'oauth', 'privacidad', 'privacy', 'robots.txt',
    'settings', 'signup', 'sitemap.xml', 'static', 'support', 'terms', 'thumbs'
  ]);
$$;

-- Si alguna página o invitación ya usara `thumbs`, el deploy se frena acá.
select private.assert_no_reserved_handles_in_use();

-- ── 1. Lo destacado de un link, solo si se ve ────────────────────────────────
-- `security definer`: la configuración y lo destacado no se leen directo. Solo
-- devuelve algo para un link que la página pública muestra (visible, en una
-- sección visible, de una cuenta activa) y si coincide con lo que el dueño
-- eligió hoy: tras cambiar de "Último video" a "Último Short", lo viejo no se
-- muestra mientras el cron trae lo nuevo.
create function public.link_featured(p_link_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'videoId', f.video_id,
    'kind', f.kind,
    'title', f.title,
    'publishedAt', f.published_at,
    'durationSeconds', f.duration_s,
    'mode', coalesce(m.featured_mode, 'latest_video')
  )
  from public.featured_content f
  join public.links l on l.id = f.link_id
  join public.profiles p on p.id = l.owner_id and not p.disabled
  left join public.link_media_settings m on m.link_id = l.id
  where f.link_id = p_link_id
    and l.visible
    and l.provider = 'youtube'
    and (
      l.section_id is null
      or exists (select 1 from public.sections s where s.id = l.section_id and s.visible)
    )
    and case coalesce(m.featured_mode, 'latest_video')
      when 'latest_video' then f.kind = 'video'
      when 'latest_short' then f.kind = 'short'
      when 'latest_stream' then f.kind = 'stream'
      when 'pinned' then f.video_id = m.pinned_video_id
      else false
    end;
$$;

revoke all on function public.link_featured(uuid) from public;
grant execute on function public.link_featured(uuid) to anon, authenticated;

-- ── 2. La vista pública suma `featured` a cada link ──────────────────────────
-- Mismas columnas: solo cambia el JSON de cada link.
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
                  'featured', public.link_featured(l.id)
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
          'featured', public.link_featured(l.id)
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
