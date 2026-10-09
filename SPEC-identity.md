# Spec: `identity`

> Módulo del [mapa de capacidades](CAPABILITY-MAP.md). Depende de
> [`platform`](SPEC-platform.md) y hereda sus comandos, estructura, estilo,
> testing y límites. Estado: **aprobado (2026-10-09)**.

## Objetivo

Que solo las personas que el admin habilita puedan entrar al panel (con GitHub
o Google) y que cada una tenga un perfil con un `handle` único, que define su
URL pública (`/{handle}`).

**Usuarios:**
- **Owner** (vos): entra al panel y habilita a otras personas.
- **Usuario habilitado** (futuro): entra y edita solo lo suyo.
- **Visitante anónimo**: no tiene cuenta; solo ve páginas públicas.

### Historias y criterios de aceptación

1. **Login.** Como usuario habilitado, entro con GitHub o Google y llego al panel.
   - Si mi email está en la allowlist, se crea mi cuenta y mi perfil con el `handle` que me asignó el admin.
   - Si ya tengo cuenta con un proveedor y entro con el otro usando el mismo email verificado, accedo a la misma cuenta.
2. **Registro cerrado.** Como persona no habilitada, si intento entrar con GitHub o Google, no se crea ninguna cuenta y veo un mensaje claro ("Esta cuenta no tiene acceso. Pedile una invitación al administrador."), sin revelar si el email existe.
3. **Rutas protegidas.** Sin sesión, cualquier ruta bajo `/admin` redirige a `/login?next=<ruta>`. Después del login vuelvo a esa ruta, **solo si es interna**.
4. **Logout.** Cierra la sesión del dispositivo actual y borra las cookies. Hay una opción "cerrar sesión en todos los dispositivos".
5. **Alta de usuarios (v1).** El owner habilita un email con su `handle` mediante un comando (`pnpm user:allow <email> <handle>`). La UI para hacerlo se construye en `admin-panel`.
6. **Perfil.** Cada usuario tiene `handle`, nombre visible, bio y avatar. El email nunca es público.

## Diseño

### Flujo de login

```
/login ──(signInWithOAuth, PKCE)──▶ GitHub/Google ──▶ Supabase Auth
                                                      │
                                   hook before_user_created (solo cuentas nuevas)
                                   ├─ email en allowlist y verificado → crea usuario
                                   └─ si no → 403, no se crea nada
                                                      │
/auth/callback ◀──────────────(code)──────────────────┘
  ├─ exchangeCodeForSession(code)
  ├─ valida `next` con safeRedirectPath() → solo rutas internas
  └─ redirect → /admin (o `next`)
```

- **Proveedores:** GitHub y Google. En `supabase/config.toml` quedan desactivados el email/contraseña y el teléfono, y `enable_signup` queda activo solo para que el hook decida.
- **Allowlist:** el hook `before_user_created` es una función Postgres (no una Edge Function: no hay red ni secretos de webhook que filtrar). Compara el email normalizado (minúsculas, sin espacios) contra `private.allowed_emails` y exige que el proveedor lo informe como verificado.
- **Perfil:** un trigger `on auth.users insert` crea la fila en `public.profiles` con el `handle` de la allowlist. Es la única forma de crear perfiles.
- **Vinculación de cuentas:** Supabase vincula automáticamente identidades con el mismo email verificado. Se agrega un test para verificarlo.

### Sesiones

- Solo se usa el **cliente de servidor** (`@supabase/ssr` con `createServerClient`) en `middleware.ts`. No existe cliente de Supabase en el navegador para auth, así que las cookies pueden ser `HttpOnly`.
- Cookies `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- La identidad se lee con `auth.getClaims()`, que verifica la firma del JWT con las claves asimétricas del proyecto (JWKS). Nunca se confía en `getSession()` del lado del servidor.
- `middleware.ts` arma `locals.user: SessionUser | null` y aplica la regla de `/admin/*`. Las páginas no hablan con Supabase Auth directamente: usan el puerto `SessionReader`.
- **CSRF:** `security.checkOrigin` de Astro activo para POST/PUT/PATCH/DELETE. Las Actions del panel solo aceptan POST.
- **Rate limiting:** Supabase Auth trae límites por IP; además, `/login` y `/auth/*` usan el binding de Rate Limiting de Cloudflare (por ejemplo 10 solicitudes por minuto por IP).

### Modelo de datos

```sql
-- Esquema `private`: no se expone por la API REST de Supabase.
create table private.allowed_emails (
  email       citext primary key check (email = lower(trim(email))),
  handle      citext not null unique,
  invited_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create type public.user_role as enum ('owner', 'member');

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        citext not null unique,
  display_name  text not null check (char_length(display_name) between 1 and 60),
  bio           text check (char_length(bio) <= 160),
  avatar_url    text check (avatar_url ~ '^https://'),
  role          public.user_role not null default 'member',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.profiles enable row level security;
```

**Políticas RLS de `profiles`:**

| Operación | Quién | Regla |
|---|---|---|
| `select` | `anon`, `authenticated` | Todas las filas (son datos públicos; el email no está en esta tabla) |
| `update` | `authenticated` | Solo `id = auth.uid()`. Las columnas `role`, `handle` e `id` no se pueden cambiar (privilegios por columna: `grant update (display_name, bio, avatar_url)`) |
| `insert` / `delete` | nadie | Solo el trigger y el `on delete cascade` |

**`handle`:** 3 a 30 caracteres, `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`, sin guiones dobles. Se reservan las rutas propias (`admin`, `api`, `auth`, `login`, `logout`, `mcp`, `oauth`, `_astro`, `.well-known`, `robots.txt`, `sitemap.xml`, `favicon.ico`…). La lista vive en `src/domain/handle.ts` y en un `check` de la base generado desde el mismo origen.

### Código (puertos y casos de uso)

| Capa | Archivo | Responsabilidad |
|---|---|---|
| domain | `handle.ts` | Value object `Handle` + schema Zod + palabras reservadas |
| domain | `safe-redirect.ts` | `safeRedirectPath(input): string`: devuelve la ruta solo si es relativa e interna; si no, `/admin` |
| application/ports | `session-reader.ts` | `getCurrentUser(): Promise<SessionUser \| null>` |
| application/ports | `profile-repository.ts` | `ProfileReader` / `ProfileWriter` |
| application | `get-public-profile.ts`, `update-own-profile.ts` | Casos de uso |
| infrastructure/supabase | `supabase-session-reader.ts`, `supabase-profile-repository.ts` | Adaptadores |
| pages | `login.astro`, `auth/callback.ts`, `auth/logout.ts` | Rutas finas |
| scripts | `allow-user.ts` | Comando `pnpm user:allow`. Usa la `service_role` key **solo** desde la máquina del owner; nunca se despliega |

## Seguridad: amenazas y mitigaciones

| Amenaza | Mitigación | Test |
|---|---|---|
| Alguien sin invitación crea una cuenta | Hook `before_user_created` con allowlist | pgTAP: hook rechaza email no listado; acepta listado; insensible a mayúsculas y espacios |
| Toma de cuenta con un email no verificado del proveedor | El hook exige `email_verified` | pgTAP: rechaza un evento con email no verificado |
| Open redirect en `next` tras el login | `safeRedirectPath` rechaza URLs absolutas, `//host`, `\\host`, `/\host`, esquemas y caracteres de control | Unit: tabla de payloads maliciosos |
| Robo de sesión por XSS | Cookies `HttpOnly`; CSP estricta (de `platform`) | E2E: `document.cookie` no expone tokens |
| CSRF en acciones del panel | `checkOrigin` + `SameSite=Lax` + solo POST | E2E: POST desde otro origen → 403 |
| Escalada de privilegios (cambiarse el `role` o el `handle`) | Privilegios por columna + RLS | pgTAP: `update role` como `authenticated` falla |
| Editar el perfil de otro usuario | RLS `id = auth.uid()` | pgTAP con dos usuarios |
| Leer la allowlist | Esquema `private` sin grants para `anon`/`authenticated` | pgTAP: `select` falla para ambos roles |
| JWT falsificado o vencido | `getClaims()` verifica la firma con JWKS | Integración: token alterado → `null` |
| Fuerza bruta o abuso del login | Rate limiting de Supabase y Cloudflare | E2E: la solicitud 11 en un minuto → 429 |
| Enumeración de usuarios | Mismo mensaje para "no habilitado" y cualquier otro error | E2E: el texto no varía |
| Robo de la `service_role` key | Nunca en el Worker de requests; `user:allow` corre solo en local | Semgrep: regla que prohíbe importar el cliente admin desde `src/pages` y `src/actions` |

## Testing

- **Unit:** `Handle` (válidos, reservados, Unicode, longitud), `safeRedirectPath` (≥ 15 casos maliciosos), casos de uso con puertos falsos.
- **pgTAP:** hook de allowlist, trigger de perfil, todas las políticas de `profiles` con `anon`, dueño, otro usuario y `service_role`; grants del esquema `private`.
- **Integración:** `SupabaseSessionReader` con un token válido, alterado y vencido contra Supabase local.
- **E2E:** no se puede automatizar el login real con GitHub ni Google. En local y en CI, la sesión de prueba se genera con la API admin de Supabase local (`generateLink`) desde el *setup* de Playwright. Ese camino solo existe en la configuración de tests y no se despliega.
  - Sin sesión, `/admin` redirige a `/login?next=%2Fadmin`.
  - Con sesión, `/admin` responde 200; el logout borra las cookies.
  - Cabeceras y atributos de cookie correctos.

## Fuera de alcance

- UI para gestionar la allowlist (va en `admin-panel`).
- Registro público y verificación de email propia.
- Passkeys y 2FA propio (lo delegamos en GitHub y Google, que ya lo tienen).
- Roles más finos que `owner` y `member`.

## Criterios de éxito

- [ ] Con GitHub y con Google, un email de la allowlist entra al panel y obtiene su perfil con el `handle` asignado.
- [ ] Un email fuera de la allowlist no crea ninguna fila en `auth.users` (pgTAP + prueba manual).
- [ ] Todas las filas de la tabla de amenazas tienen su test y está en verde en CI.
- [ ] `/admin/*` es inaccesible sin sesión (E2E).
- [ ] El login con un proveedor y luego con el otro (mismo email) termina en la misma cuenta (prueba manual documentada).
- [ ] La `service_role` key no aparece en el bundle del Worker (chequeo en CI con `grep` sobre `dist/`).

## Preguntas abiertas

1. ~~Proveedores OAuth~~ Hay acceso a Google Cloud Console; la OAuth App de GitHub y el cliente de Google se crean con `wizard` al implementar.
2. ~~Handle del owner~~ `juedsay` (rol `owner`; va en `seed.sql` y en la allowlist de producción).
3. **A verificar al implementar:** el campo exacto donde el evento del hook informa `email_verified` según el proveedor. Si no viene confiable, se lee de `identities` antes de decidir.
