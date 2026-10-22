-- Datos de desarrollo de Plektia. Solo datos ficticios: nunca datos reales de terceros.
-- Se cargan con `pnpm db:reset`. Los links de prueba se suman en la tarea 13.

-- Invitaciones: el owner (handle real del proyecto, email ficticio) y un miembro.
insert into private.allowed_emails (email, handle, role) values
  ('owner@plektia.test', 'juedsay', 'owner'),
  ('member@plektia.test', 'miembro-demo', 'member');

-- Usuarios locales: el trigger `on_auth_user_created` les crea el perfil. GoTrue
-- espera texto vacío (no NULL) en las columnas de tokens: con NULL falla el login.
insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
   'owner@plektia.test', now(), '{"provider":"github","providers":["github"]}', '{"full_name":"Julián (dev)"}',
   '', '', '', '', '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
   'member@plektia.test', now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Miembro Demo"}',
   '', '', '', '', '', '', '', '', now(), now());

-- Página de ejemplo del owner (como el prototipo de public-page). Datos de
-- desarrollo: en producción cada uno carga los suyos desde el panel.
update public.profiles set bio = 'Streams, código y diseño' where handle = 'juedsay';

insert into public.sections (id, owner_id, title) values
  ('5e000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Redes'),
  ('5e000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Proyectos'),
  ('5e000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Artículos');

insert into public.links (owner_id, section_id, title, url, description, provider, provider_handle) values
  ('11111111-1111-4111-8111-111111111111', '5e000000-0000-4000-8000-000000000001', 'Twitch', 'https://www.twitch.tv/juedsay', 'Streams de código en vivo', 'twitch', 'juedsay'),
  ('11111111-1111-4111-8111-111111111111', '5e000000-0000-4000-8000-000000000001', 'YouTube', 'https://www.youtube.com/@juedsay', null, 'youtube', '@juedsay'),
  ('11111111-1111-4111-8111-111111111111', '5e000000-0000-4000-8000-000000000001', 'Instagram', 'https://www.instagram.com/juedsay', null, 'instagram', null),
  ('11111111-1111-4111-8111-111111111111', '5e000000-0000-4000-8000-000000000002', 'Plektia', 'https://app.plektia.workers.dev/', 'Esta página: links, en vivo y MCP', 'generic', null),
  ('11111111-1111-4111-8111-111111111111', '5e000000-0000-4000-8000-000000000002', 'GitHub', 'https://github.com/juedsay', null, 'github', null),
  ('11111111-1111-4111-8111-111111111111', '5e000000-0000-4000-8000-000000000003', 'Cómo testeo RLS con pgTAP', 'https://github.com/juedsay/plektia/tree/main/supabase/tests', null, 'generic', null);

-- Perfil con 50 links (5 secciones de 10, con descripción): el caso que mide el
-- presupuesto de HTML de la página pública (SPEC-public-page: ≤ 30 KB con 50 links).
update public.profiles set bio = 'Perfil de prueba con 50 links para medir el rendimiento.'
where handle = 'miembro-demo';

insert into public.sections (id, owner_id, title)
select ('5e000000-0000-4000-8000-00000000010' || s)::uuid, '22222222-2222-4222-8222-222222222222', 'Sección ' || s
from generate_series(1, 5) s;

insert into public.links (owner_id, section_id, title, url, description)
select '22222222-2222-4222-8222-222222222222',
       ('5e000000-0000-4000-8000-00000000010' || ((n - 1) / 10 + 1))::uuid,
       'Link de prueba número ' || n,
       'https://plektia.app/demo/' || n,
       'Descripción corta del link ' || n || ' para medir el peso real'
from generate_series(1, 50) n;
