-- Modo claro, oscuro y automático (tarea 34, SPEC-appearance "Entrega 6a").
--
-- `pages.color_mode`: el modo de la página pública. `auto` sigue al dispositivo
-- de cada visitante (`prefers-color-scheme`, en CSS). Todas las páginas, también
-- las que ya existían, empiezan en `auto` (decisión del 2026-10-29).
-- `account_preferences.panel_mode`: el modo del panel, guardado en la cuenta.
-- Va en una tabla propia y no en `profiles`, que el público puede leer: la
-- preferencia del panel no tiene por qué verla nadie más que su dueño.

create type public.color_mode as enum ('auto', 'dark', 'light');

alter table public.pages
  add column color_mode public.color_mode not null default 'auto';

create table public.account_preferences (
  user_id    uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  panel_mode public.color_mode not null default 'auto',
  updated_at timestamptz not null default now()
);

alter table public.account_preferences enable row level security;

revoke all on public.account_preferences from anon, authenticated;
grant select on public.account_preferences to authenticated;
grant insert (user_id, panel_mode), update (panel_mode) on public.account_preferences to authenticated;

-- Solo el dueño, activo y desde el panel (un cliente MCP no cambia el panel).
create policy "el dueño ve sus preferencias" on public.account_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "el dueño guarda sus preferencias" on public.account_preferences
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and ((select auth.jwt()) ->> 'client_id') is null
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
  );

create policy "el dueño cambia sus preferencias" on public.account_preferences
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and ((select auth.jwt()) ->> 'client_id') is null
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.disabled)
  )
  with check (user_id = (select auth.uid()));

-- Por columna, como el resto de la presentación: lo cambia el dueño desde el
-- panel (las políticas de escritura ya exigen dueño activo y sin `client_id`).
grant update (color_mode) on public.pages to authenticated;

-- La vista pública suma el modo (al final: `create or replace` solo agrega columnas).
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
                  'live', public.link_live(l.id)
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
                  'live', public.link_live(l.id)
        )
        order by l.position
      )
      from public.links l
      where l.page_id = pg.id and l.section_id is null and l.visible
    ),
    '[]'::jsonb
  ) as unsectioned_links,
  pg.show_handle,
  pg.color_mode
from public.pages pg
join public.profiles pr on pr.id = pg.owner_id
where not pr.disabled;

revoke all on public.public_page_v from anon, authenticated;
grant select on public.public_page_v to anon, authenticated;
