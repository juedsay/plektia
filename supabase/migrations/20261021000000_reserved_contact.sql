-- `/contact` es la página de contacto (las rutas propias van en inglés);
-- `contacto` sigue reservado porque redirige ahí. La misma lista vive en
-- `src/domain/handle.ts`; un test compara la definición más reciente.
create or replace function private.is_reserved_handle(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(value) = any (array[
    '_astro', '.well-known', 'about', 'admin', 'api', 'app', 'assets', 'auth',
    'contact', 'contacto', 'favicon.ico', 'help', 'login', 'logout', 'mcp', 'new',
    'oauth', 'plektia', 'privacidad', 'privacy', 'robots.txt', 'settings', 'signup',
    'sitemap.xml', 'static', 'support', 'terms'
  ]);
$$;
