-- `/legal/*` agrupa los documentos legales (privacidad ahora; términos, uso
-- aceptable y denuncias cuando abra el registro). La misma lista vive en
-- `src/domain/handle.ts`; un test compara la definición más reciente.
create or replace function private.is_reserved_handle(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(value) = any (array[
    '_astro', '.well-known', 'about', 'admin', 'api', 'app', 'assets', 'auth',
    'contact', 'contacto', 'favicon.ico', 'help', 'legal', 'login', 'logout', 'mcp',
    'new', 'oauth', 'plektia', 'privacidad', 'privacy', 'robots.txt', 'settings',
    'signup', 'sitemap.xml', 'static', 'support', 'terms'
  ]);
$$;

-- Si algún perfil o invitación ya usara `legal`, el deploy se frena acá.
select private.assert_no_reserved_handles_in_use();
