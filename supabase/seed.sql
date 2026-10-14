-- Datos de desarrollo de Plektia. Solo datos ficticios: nunca datos reales de terceros.
-- Se cargan con `pnpm db:reset`. Los links de prueba se suman en la tarea 13.

-- Invitaciones: el owner (handle real del proyecto, email ficticio) y un miembro.
insert into private.allowed_emails (email, handle, role) values
  ('owner@plektia.test', 'juedsay', 'owner'),
  ('member@plektia.test', 'miembro-demo', 'member');

-- Usuarios locales: el trigger `on_auth_user_created` les crea el perfil.
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
   'owner@plektia.test', now(), '{"provider":"github","providers":["github"]}', '{"full_name":"Julián (dev)"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
   'member@plektia.test', now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Miembro Demo"}', now(), now());
