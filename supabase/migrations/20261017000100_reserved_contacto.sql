-- `/contacto` y `/privacidad` son páginas propias en la raíz: nadie puede tener
-- esos handles. La misma lista vive en `src/domain/handle.ts`; un test compara
-- la definición más reciente de esta función con la del dominio.
create or replace function private.is_reserved_handle(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(value) = any (array[
    '_astro', '.well-known', 'about', 'admin', 'api', 'app', 'assets', 'auth',
    'contacto', 'favicon.ico', 'help', 'login', 'logout', 'mcp', 'new', 'oauth',
    'plektia', 'privacidad', 'privacy', 'robots.txt', 'settings', 'signup',
    'sitemap.xml', 'static', 'support', 'terms'
  ]);
$$;
