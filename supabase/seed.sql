-- Datos de desarrollo de Plektia. Solo datos ficticios: nunca datos reales de terceros.
-- Se cargan con `pnpm db:reset`. Los links de prueba se suman en la tarea 13.

-- Invitaciones: el owner (handle real del proyecto, email ficticio) y un miembro.
insert into private.allowed_emails (email, handle, role) values
  ('owner@plektia.test', 'juedsay', 'owner'),
  ('member@plektia.test', 'miembro-demo', 'member'),
  -- La cuenta Admin de Plektia: dueña de la página oficial (tarea 21b).
  ('admin@plektia.test', 'plektia', 'owner'),
  -- Cuenta propia de los E2E del avatar: los archivos corren en paralelo y
  -- otros cambian la página actual del miembro.
  ('avatar@plektia.test', 'avatar-demo', 'member');

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
   '', '', '', '', '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'adadadad-0000-4000-8000-00000000ad01', 'authenticated', 'authenticated',
   'admin@plektia.test', now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Plektia"}',
   '', '', '', '', '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated',
   'avatar@plektia.test', now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Avatar Demo"}',
   '', '', '', '', '', '', '', '', now(), now());

-- La primera página de cada cuenta del seed toma el id de su dueño, como las
-- páginas migradas en producción (SPEC-pages): los datos de abajo los usan.
update public.pages set id = owner_id
where owner_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'adadadad-0000-4000-8000-00000000ad01',
  '44444444-4444-4444-8444-444444444444'
);

-- Página oficial (/plektia), como la que carga la cuenta Admin en producción.
update public.pages set bio = 'Todos tus links, unidos por un hilo.' where handle = 'plektia';

insert into public.sections (id, owner_id, page_id, title) values
  ('5e000000-0000-4000-8000-000000000201', 'adadadad-0000-4000-8000-00000000ad01', 'adadadad-0000-4000-8000-00000000ad01', 'Novedades'),
  ('5e000000-0000-4000-8000-000000000202', 'adadadad-0000-4000-8000-00000000ad01', 'adadadad-0000-4000-8000-00000000ad01', 'Sobre Plektia'),
  ('5e000000-0000-4000-8000-000000000203', 'adadadad-0000-4000-8000-00000000ad01', 'adadadad-0000-4000-8000-00000000ad01', 'Legal');

insert into public.links (owner_id, page_id, section_id, title, url, description) values
  ('adadadad-0000-4000-8000-00000000ad01', 'adadadad-0000-4000-8000-00000000ad01', '5e000000-0000-4000-8000-000000000201', 'Ya está la página pública', 'https://app.plektia.workers.dev/', 'El diseño de la patchera, con el hilo'),
  ('adadadad-0000-4000-8000-00000000ad01', 'adadadad-0000-4000-8000-00000000ad01', '5e000000-0000-4000-8000-000000000202', 'Qué es Plektia', 'https://app.plektia.workers.dev/', 'Todos tus links, unidos por un hilo'),
  ('adadadad-0000-4000-8000-00000000ad01', 'adadadad-0000-4000-8000-00000000ad01', '5e000000-0000-4000-8000-000000000202', 'Contacto', 'https://app.plektia.workers.dev/contact', 'Pedí tu invitación o escribinos'),
  ('adadadad-0000-4000-8000-00000000ad01', 'adadadad-0000-4000-8000-00000000ad01', '5e000000-0000-4000-8000-000000000202', 'Entrar', 'https://app.plektia.workers.dev/login', 'Si ya tenés tu invitación'),
  ('adadadad-0000-4000-8000-00000000ad01', 'adadadad-0000-4000-8000-00000000ad01', '5e000000-0000-4000-8000-000000000203', 'Política de privacidad', 'https://app.plektia.workers.dev/legal/privacy', 'Qué datos guardamos y cómo pedir que los borremos');

-- Página de ejemplo del owner (como el prototipo de public-page). Datos de
-- desarrollo: en producción cada uno carga los suyos desde el panel.
update public.pages set bio = 'Streams, código y diseño' where handle = 'juedsay';

insert into public.sections (id, owner_id, page_id, title) values
  ('5e000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Redes'),
  ('5e000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Proyectos'),
  ('5e000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Artículos');

insert into public.links (owner_id, page_id, section_id, title, url, description, provider, provider_handle) values
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '5e000000-0000-4000-8000-000000000001', 'Twitch', 'https://www.twitch.tv/juedsay', 'Streams de código en vivo', 'twitch', 'juedsay'),
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '5e000000-0000-4000-8000-000000000001', 'YouTube', 'https://www.youtube.com/@juedsay', null, 'youtube', '@juedsay'),
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '5e000000-0000-4000-8000-000000000001', 'Instagram', 'https://www.instagram.com/juedsay', null, 'instagram', null),
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '5e000000-0000-4000-8000-000000000002', 'Plektia', 'https://app.plektia.workers.dev/', 'Esta página: links, en vivo y MCP', 'generic', null),
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '5e000000-0000-4000-8000-000000000002', 'GitHub', 'https://github.com/juedsay', null, 'github', null),
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '5e000000-0000-4000-8000-000000000003', 'Cómo testeo RLS con pgTAP', 'https://github.com/juedsay/plektia/tree/main/supabase/tests', null, 'generic', null);

-- Segunda página del owner (SPEC-pages), con sus propios links en su propio
-- /{handle}. Datos ficticios: nada que parezca de una persona real.
insert into public.pages (id, owner_id, handle, display_name, bio) values
  ('9a9e0000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'demo-segunda',
   'Página de prueba', 'Segunda página de la misma cuenta');

insert into public.links (owner_id, page_id, title, url, description) values
  ('11111111-1111-4111-8111-111111111111', '9a9e0000-0000-4000-8000-000000000002', 'Documentación', 'https://plektia.app/docs', 'Cómo funciona Plektia'),
  ('11111111-1111-4111-8111-111111111111', '9a9e0000-0000-4000-8000-000000000002', 'Novedades', 'https://plektia.app/novedades', null);

-- Perfil con 50 links (5 secciones de 10, con descripción): el caso que mide el
-- presupuesto de HTML de la página pública (SPEC-public-page: ≤ 30 KB con 50 links).
update public.pages set bio = 'Perfil de prueba con 50 links para medir el rendimiento.'
where handle = 'miembro-demo';

insert into public.sections (id, owner_id, page_id, title)
select ('5e000000-0000-4000-8000-00000000010' || s)::uuid, '22222222-2222-4222-8222-222222222222',
       '22222222-2222-4222-8222-222222222222', 'Sección ' || s
from generate_series(1, 5) s;

insert into public.links (owner_id, page_id, section_id, title, url, description)
select '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
       ('5e000000-0000-4000-8000-00000000010' || ((n - 1) / 10 + 1))::uuid,
       'Link de prueba número ' || n,
       'https://plektia.app/demo/' || n,
       'Descripción corta del link ' || n || ' para medir el peso real'
from generate_series(1, 50) n;
