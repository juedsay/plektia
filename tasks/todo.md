# Tareas: Plektia v1

> Plan y contexto en [plan.md](plan.md). Cada tarea cumple además la definición de terminado de
> [SPEC-platform.md](../SPEC-platform.md): `pnpm check`, `pnpm lint` y `pnpm test` en verde, tests de
> seguridad incluidos y commit a tu nombre sin coautoría.
>
> Tamaños: S = 1–2 archivos · M = 3–5 archivos.

---

## F1 · Platform

- [x] **Tarea 1: Scaffold de Astro 7 en Cloudflare** · M · Deps: ninguna
  - Astro 7 + `@astrojs/cloudflare` + `@astrojs/react`, pnpm 12 vía Corepack, Node 24, TS estricto, `.gitattributes` (LF), `.nvmrc`, `.env.example`, alias `@/`.
  - **Aceptación:**
    - `pnpm dev` muestra una página "Hola Plektia" en el runtime workerd.
    - Se verifica la compatibilidad de TypeScript 7; si falla, se fija la 6.x.
    - ADR 0001 (Astro + Cloudflare) y ADR 0002 (versión de TypeScript) escritos.
  - **Verificar:** `pnpm check` y `pnpm build` sin errores; `pnpm dev` y abrir la página.
  - **Archivos:** `package.json`, `astro.config.mjs`, `tsconfig.json`, `wrangler.jsonc`, `docs/adr/0001-*.md`, `docs/adr/0002-*.md`.

- [x] **Tarea 2: Calidad de código y tests unitarios** · M · Deps: 1
  - ESLint (flat) + `typescript-eslint` + `eslint-plugin-astro`, Prettier, Vitest 5 con cobertura (90 % en `domain`/`application`, 80 % global) y el primer módulo `src/domain/result.ts` con tests.
  - **Aceptación:**
    - `pnpm lint` y `pnpm test:coverage` pasan.
    - Bajar la cobertura del umbral hace fallar el comando.
  - **Verificar:** `pnpm test:coverage`.
  - **Archivos:** `eslint.config.js`, `.prettierrc`, `vitest.config.ts`, `src/domain/result.ts`, `tests/unit/domain/result.test.ts`.

- [x] **Tarea 3: Supabase local y pgTAP** · M · Deps: 1
  - `supabase init`, `config.toml` (email/contraseña desactivados), scripts `db:*`, una migración vacía de base, la primera prueba pgTAP y `db:types`.
  - **Aceptación:**
    - `pnpm db:start && pnpm db:reset && pnpm test:db` pasa en un clon limpio.
    - Los tipos se generan en `src/infrastructure/supabase/database.types.ts`.
  - **Verificar:** los tres comandos.
  - **Archivos:** `supabase/config.toml`, `supabase/migrations/0000_base.sql`, `supabase/tests/0000_smoke.test.sql`, `package.json`.

- [x] **Tarea 4: Cabeceras de seguridad y harness E2E** · M · Deps: 1
  - `security.csp` de Astro + `middleware.ts` con el resto de las cabeceras; Playwright 1.64 con un test que verifica la CSP, HSTS, `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy` y `X-Content-Type-Options`.
  - **Aceptación:** el E2E de cabeceras pasa contra `pnpm preview`.
  - **Verificar:** `pnpm test:e2e`.
  - **Archivos:** `astro.config.mjs`, `src/middleware.ts`, `playwright.config.ts`, `e2e/security-headers.spec.ts`.

- [x] **Tarea 5: CI en GitHub Actions** · M · Deps: 2, 3, 4
  - Workflow con: check → lint → test:coverage → test:db → build → e2e → `pnpm audit` → gitleaks → Semgrep. Incluye reglas propias:
    - sin `set:html` ni `dangerouslySetInnerHTML` con datos de usuario;
    - la clave de servicio solo en `**/ingest-client.ts`.

    Actions fijadas por SHA, permisos mínimos, Renovate y protección de `main`.
  - **Aceptación:**
    - Un PR de prueba pasa la CI.
    - Commitear una clave falsa la hace fallar (gitleaks).
    - Una dependencia vulnerable la hace fallar.
  - **Verificar:** PRs de prueba en GitHub.
  - **Archivos:** `.github/workflows/ci.yml`, `.semgrep/rules.yml`, `renovate.json`.

- [x] **Tarea 6: Deploy y cron (spike de riesgos)** · M · Deps: 5
  - `src/worker.ts` con `fetch` + `scheduled`. Deploy desde `main` a `*.workers.dev` con `wrangler`. `wizard` para el token de Cloudflare y el proyecto de Supabase en la nube.
  - **Spike:** que la purga de Workers Cache funcione desde `scheduled`.
  - **Aceptación:**
    - La URL pública responde con las cabeceras de seguridad.
    - `wrangler dev --test-scheduled` registra el cron.
    - El resultado del spike queda documentado en un ADR.
  - **Verificar:** E2E de cabeceras contra la URL desplegada; logs del cron.
  - **Archivos:** `src/worker.ts`, `wrangler.jsonc`, `.github/workflows/deploy.yml`, `scripts/wizard-deploy.sh`, `docs/adr/0003-*.md`.

### ✅ Checkpoint F1
- [ ] Los 4 niveles de tests corren en CI; el deploy automático funciona; el README explica cómo levantar el proyecto.
- [ ] Revisión con vos antes de seguir.

---

## F2 · Identity

- [x] **Tarea 7: Esquema de identidad y registro cerrado** · M · Deps: 3
  - Migración: `private.allowed_emails`, `profiles` (con `role`, `theme`, `avatar_path`, `disabled`), hook `before_user_created` (allowlist + email verificado), trigger de perfil, RLS y privilegios por columna, y handles reservados (incluido `plektia`).
  - **Aceptación:** los tests pgTAP de la tabla de amenazas de `identity` pasan: allowlist, email no verificado, escalada de rol, perfil ajeno y lectura de la allowlist.
  - **Verificar:** `pnpm test:db`.
  - **Archivos:** `supabase/migrations/20261014180000_identity.sql`, `supabase/tests/0001_identity.test.sql`, `supabase/seed.sql`.

- [ ] **Tarea 8: Sesión del servidor y rutas protegidas** · M · Deps: 7
  - Dominio: `Handle` y `safeRedirectPath`, con 15 o más casos maliciosos. Puerto `SessionReader` + adaptador con `getClaims()`, cliente de servidor con cookies `HttpOnly` y middleware que protege `/admin/*`.
  - **Aceptación:**
    - Unit e integración pasan (token válido, alterado y vencido).
    - `/admin` sin sesión redirige a `/login?next=`.
  - **Verificar:** `pnpm test`; E2E de redirección.
  - **Archivos:** `src/domain/handle.ts`, `src/domain/safe-redirect.ts`, `src/application/ports/session-reader.ts`, `src/infrastructure/supabase/supabase-session-reader.ts`, `src/middleware.ts`.

- [ ] **Tarea 9: Login con GitHub y Google** · M · Deps: 8
  - `wizard` para la OAuth App de GitHub y el cliente de Google. Páginas `/login`, `/auth/callback` y `/auth/logout`; rate limit; mensaje único de "sin acceso"; script `pnpm user:allow`. En E2E, la sesión de prueba sale de la API admin local.
  - **Aceptación:**
    - Entrás con GitHub y con Google (prueba manual documentada).
    - Un correo no invitado no crea cuenta.
    - Los E2E de CSRF, cookies y rate limit pasan.
  - **Verificar:** `pnpm test:e2e`; prueba manual en el deploy.
  - **Archivos:** `src/pages/login.astro`, `src/pages/auth/callback.ts`, `src/pages/auth/logout.ts`, `scripts/allow-user.ts`, `e2e/auth.spec.ts`.

### ✅ Checkpoint F2
- [ ] Entrás a `/admin` (vacío) en producción con tu cuenta; nadie más puede.
- [ ] Revisión con vos.

---

## F3 · Links

- [ ] **Tarea 10: Dominio de links** · M · Deps: 2
  - `parseSafeUrl` (30 o más casos, incluidos los maliciosos), `detectProvider` (host exacto), schemas Zod de link y sección, y el mapa de errores en español.
  - **Aceptación:** cobertura ≥ 90 %; los casos de la tabla de amenazas están cubiertos.
  - **Verificar:** `pnpm test:coverage`.
  - **Archivos:** `src/domain/safe-url.ts`, `src/domain/provider.ts`, `src/domain/link.ts`, `src/domain/section.ts`, `src/domain/errors.ts`.

- [ ] **Tarea 11: Esquema de links con RLS y operaciones atómicas** · M · Deps: 7
  - Tablas `sections` y `links`, índices, triggers (dueño de la sección, límites, recolocar al borrar), RPC `reorder_sections` y `move_links`, y políticas RLS (con la condición `client_id is null` en escrituras, preparada para el MCP).
  - **Aceptación:** pgTAP de todas las políticas con 4 roles, de los triggers, de la atomicidad y de los `check` de URL.
  - **Verificar:** `pnpm test:db`.
  - **Archivos:** `supabase/migrations/0002_links.sql`, `supabase/tests/links.test.sql`, `supabase/tests/links-rpc.test.sql`.

- [ ] **Tarea 12: Casos de uso y repositorio** · M · Deps: 10, 11
  - Puertos `LinkReader` y `LinkWriter`, los casos de uso de links y secciones, y `SupabaseLinkRepository` con `version` optimista.
  - **Aceptación:**
    - Unit con puertos falsos.
    - Integración contra Supabase local, incluido el `conflict` con dos updates.
    - Reorden aleatorio repetido sin duplicados.
  - **Verificar:** `pnpm test`.
  - **Archivos:** `src/application/ports/link-repository.ts`, `src/application/links/*.ts`, `src/application/sections/*.ts`, `src/infrastructure/supabase/supabase-link-repository.ts`.

- [ ] **Tarea 13: Vista pública y seed** · S · Deps: 12
  - `public_page_v` (`security_invoker`) + `get-public-page` + seed con tus secciones y links reales.
  - **Aceptación:**
    - Una sola consulta devuelve la página.
    - Lo oculto no aparece para `anon` (pgTAP).
  - **Verificar:** `pnpm test:db && pnpm test`.
  - **Archivos:** `supabase/migrations/0003_public_view.sql`, `src/application/public/get-public-page.ts`, `supabase/seed.sql`.

### ✅ Checkpoint F3
- [ ] Todo el núcleo con RLS probado; cada amenaza de `links` con su test en verde.
- [ ] Revisión con vos.

---

## F4 · Public page → ENTREGA 1

- [ ] **Tarea 14: Página `/{handle}` desde el prototipo** · M · Deps: 13
  - Portar tokens, estilos y componentes Astro (`ProfileHeader`, `Bank`, `Port`, `LatestVideo`, `Footer`). Rutas `[handle]`, `/` (`DEFAULT_HANDLE`) y 404.
  - **Aceptación:** la comparación visual con el prototipo a 390 y 1440 px, con la semilla del hilo fija, pasa.
  - **Verificar:** `pnpm test:e2e` (capturas de referencia).
  - **Archivos:** `src/pages/[handle].astro`, `src/pages/index.astro`, `src/pages/404.astro`, `src/ui/components/*.astro`, `src/ui/styles/*.css`.

- [ ] **Tarea 15: Scripts del hilo, del video y de compartir en TypeScript** · M · Deps: 14
  - `thread.ts`, `disclosure.ts` y `share.ts` tipados, con la semilla configurable solo en tests.
  - **Aceptación:**
    - Un test con 1.000 semillas confirma que el hilo nunca entra en la columna de texto.
    - El disclosure funciona con teclado.
    - El fallback de compartir copia el link.
  - **Verificar:** `pnpm test` + E2E.
  - **Archivos:** `src/ui/scripts/thread.ts`, `src/ui/scripts/disclosure.ts`, `src/ui/scripts/share.ts`, `tests/unit/ui/thread.test.ts`.

- [ ] **Tarea 16: Fuente propia, SEO y páginas de Plektia** · M · Deps: 14
  - `@fontsource-variable/bricolage-grotesque` (solo subset latino), métricas de respaldo, metadatos, OG, JSON-LD `ProfilePage`, sitemap, robots, y las páginas `/plektia` y `/plektia/privacidad`.
  - **Aceptación:**
    - Cero requests a Google al cargar.
    - Validadores de metadatos sin errores.
    - La política de privacidad refleja lo implementado.
  - **Verificar:** E2E de red; Rich Results Test manual.
  - **Archivos:** `src/ui/styles/fonts.css`, `src/ui/components/Seo.astro`, `src/pages/plektia/index.astro`, `src/pages/plektia/privacidad.astro`, `src/pages/sitemap.xml.ts`.

- [ ] **Tarea 17: Caché, rendimiento y accesibilidad** · M · Deps: 15, 16
  - `Cache-Control` + `Cache-Tag` y el helper `purgeProfile(handle)`. Lighthouse CI con los presupuestos del spec, axe AAA en E2E, y tests de "sin cookies" y "sin terceros".
  - **Aceptación:** todos los presupuestos y AAA en verde en CI.
  - **Verificar:** CI.
  - **Archivos:** `src/infrastructure/cache/purge.ts`, `lighthouserc.json`, `e2e/public-page.spec.ts`, `e2e/a11y.spec.ts`.

### ✅ Checkpoint F4 · ENTREGA 1
- [ ] `https://<tu-worker>.workers.dev/juedsay` online con tus links (cargados por seed). Ya la podés poner en tu bio.
- [ ] Revisión con vos; evaluar si hacemos el repo público.

---

## F5 · Admin panel → ENTREGA 2

- [ ] **Tarea 18: Estructura del panel y perfil** · M · Deps: 9, 12
  - Layout y navegación de `/admin` (diseño con impeccable en modo *operate*), y `/admin/perfil` (nombre, bio, tema) con Actions.
  - **Aceptación:**
    - Editar el nombre se refleja en la página pública.
    - E2E de CSRF y axe AA.
  - **Verificar:** `pnpm test:e2e`.
  - **Archivos:** `src/ui/layouts/AdminLayout.astro`, `src/pages/admin/perfil.astro`, `src/actions/profile.ts`, `src/application/profile/update-profile.ts`.

- [ ] **Tarea 19: Editor, edición en el lugar con guardado instantáneo** · M · Deps: 18
  - Isla `Editor`: listar, crear, editar y ocultar links, y "Deshacer" de 6 s. Borrado diferido con `keepalive`. Aviso de conflicto por `version`.
  - **Aceptación:** tests de componentes y E2E de crear, editar, ocultar y deshacer.
  - **Verificar:** `pnpm test && pnpm test:e2e`.
  - **Archivos:** `src/ui/islands/Editor.tsx`, `src/ui/islands/editor/*.tsx`, `src/actions/links.ts`, `src/pages/admin/index.astro`.

- [ ] **Tarea 20: Ordenar y gestionar secciones** · M · Deps: 19
  - `@dnd-kit` con mouse, toque y **teclado**, con anuncios; mover entre secciones; crear, renombrar, ocultar, mostrar u ocultar el título y borrar secciones.
  - **Aceptación:** E2E de ordenar con mouse y con teclado; el lector de pantalla anuncia los movimientos.
  - **Verificar:** `pnpm test:e2e`.
  - **Archivos:** `src/ui/islands/editor/SortableList.tsx`, `src/ui/islands/editor/SectionHeader.tsx`, `src/actions/sections.ts`.

- [ ] **Tarea 21: Vista previa en vivo y purga** · S · Deps: 19, 17
  - `/admin/vista-previa` (con `frame-ancestors 'self'`) en un iframe; las Actions purgan la caché del perfil.
  - **Aceptación:** el cambio se ve en la vista previa en menos de 1 s y en la página pública en menos de 5 s.
  - **Verificar:** E2E.
  - **Archivos:** `src/pages/admin/vista-previa.astro`, `src/actions/*.ts`.

- [ ] **Tarea 22: Avatar** · M · Deps: 18
  - Recorte y WebP en el navegador; validación en el servidor (*magic bytes*, tamaño y peso); bucket `avatars` con sus políticas.
  - **Aceptación:**
    - Integración: SVG, PNG renombrado, 10 MB y 4000 px → todos rechazados.
    - Las políticas de Storage, probadas con dos usuarios.
  - **Verificar:** `pnpm test`.
  - **Archivos:** `src/ui/islands/AvatarUpload.tsx`, `src/application/profile/set-avatar.ts`, `src/infrastructure/supabase/supabase-avatar-storage.ts`, `supabase/migrations/0004_avatars.sql`.

- [ ] **Tarea 23: Usuarios habilitados (owner)** · M · Deps: 18
  - Funciones `admin_invite`, `admin_revoke` y `admin_list_users` (`security definer` con chequeo de rol), `profiles.disabled` en RLS, `private.audit_log` y la UI `/admin/usuarios`.
  - **Aceptación:**
    - pgTAP: un `member` no puede; no se puede revocar al último owner.
    - E2E: invitar y revocar.
  - **Verificar:** `pnpm test:db && pnpm test:e2e`.
  - **Archivos:** `supabase/migrations/0005_admin.sql`, `src/application/admin/*.ts`, `src/pages/admin/usuarios.astro`, `src/actions/users.ts`.

### ✅ Checkpoint F5 · ENTREGA 2
- [ ] Armás y ordenás tu página entera desde el celular.
- [ ] Revisión con vos.

---

## F6 · Live status → ENTREGA 3

- [ ] **Tarea 24: Configuración de medios por link** · M · Deps: 20
  - `link_media_settings` + UI en el editor: "Transmito en este canal" y el contenido destacado (último video, Short, stream o fijado).
  - **Aceptación:** pgTAP (owner) y E2E de los interruptores.
  - **Verificar:** `pnpm test:db && pnpm test:e2e`.
  - **Archivos:** `supabase/migrations/0006_live.sql`, `src/ui/islands/editor/MediaSettings.tsx`, `src/actions/media.ts`.

- [ ] **Tarea 25: YouTube, canal y contenido destacado** · M · Deps: 24
  - `wizard` para la API key. `safeFetch` con allowlist; resolver el `@handle`; playlists `UULF`, `UUSH` y `UULV` con plan B; `ingest-client.ts`; cron horario; Short vertical en la página.
  - **Aceptación:**
    - Suite de contrato con respuestas grabadas.
    - Presupuesto de cuota.
    - Las 4 opciones de contenido destacado se ven en la página.
  - **Verificar:** `pnpm test`; prueba manual con tu canal.
  - **Archivos:** `src/infrastructure/http/safe-fetch.ts`, `src/infrastructure/providers/youtube/*.ts`, `src/infrastructure/live-status/ingest-client.ts`, `src/application/live/refresh-featured.ts`.

- [ ] **Tarea 26: En vivo con Twitch y YouTube, más "Comprobar ahora"** · M · Deps: 25
  - `wizard` para la app de Twitch. `LiveStatusProvider` (Twitch y YouTube) con la misma suite de contrato; cron cada 10 min con *lock*; regla de 25 min; purga de caché; botón "Comprobar ahora" con rate limit.
  - **Aceptación:**
    - Un canal sin vigilancia no genera llamadas.
    - E2E: el proveedor simulado en vivo muestra el badge.
  - **Verificar:** `pnpm test && pnpm test:e2e`; prueba manual con un stream real.
  - **Archivos:** `src/infrastructure/providers/twitch/*.ts`, `src/application/live/refresh-live.ts`, `src/application/live/check-now.ts`, `src/worker.ts`.

### ✅ Checkpoint F6 · ENTREGA 3
- [ ] Transmitís y tu página lo muestra; el último video se ve plegable.
- [ ] Revisión con vos.

---

## F7 · Click analytics

- [ ] **Tarea 27: Medición sin cookies** · M · Deps: 17, 23
  - Tablas diarias, `ingest_event`, `POST /api/e` (Zod, 204, rate limit, descarte del dueño) y el beacon de visitas y clics con su origen en la página.
  - **Aceptación:**
    - 100 eventos seguidos registran 30 o menos.
    - El body del beacon solo lleva `t`, `h`/`l` y `s`.
    - Sin cookies.
  - **Verificar:** `pnpm test && pnpm test:db && pnpm test:e2e`.
  - **Archivos:** `supabase/migrations/0007_stats.sql`, `src/pages/api/e.ts`, `src/infrastructure/analytics/ingest-client.ts`, `src/ui/scripts/beacon.ts`.

- [ ] **Tarea 28: Vista de estadísticas** · M · Deps: 27
  - `/admin/estadisticas` con períodos, comparación, links, países y orígenes (skill `dataviz`), una tabla equivalente por gráfico y el estado vacío.
  - **Aceptación:** E2E de visitar y que el número suba; axe AA.
  - **Verificar:** `pnpm test:e2e`.
  - **Archivos:** `src/pages/admin/estadisticas.astro`, `src/ui/components/stats/*.astro`, `src/application/stats/*.ts`.

---

## F8 · MCP server

- [ ] **Tarea 29: Grants y escrituras `mcp_*`** · M · Deps: 12, 24
  - `mcp_grants`, funciones `mcp_*` (`security definer`: grant activo, `can_write`, dueño y auditoría) y verificación de que las políticas bloquean escrituras directas con `client_id`.
  - **Aceptación:** pgTAP: un JWT con `client_id` no escribe directo; con grant de solo lectura no escribe por `mcp_*`.
  - **Verificar:** `pnpm test:db`.
  - **Archivos:** `supabase/migrations/0008_mcp.sql`, `supabase/tests/mcp.test.sql`.

- [ ] **Tarea 30: OAuth, metadatos y consentimiento** · M · Deps: 29, 9
  - `wizard` para activar el servidor OAuth de Supabase. `/.well-known/oauth-protected-resource`, el verificador de tokens (JWKS, `iss`, `aud`, `exp`, `client_id` y grant) y `/oauth/consent` (host destacado, solo lectura por defecto).
  - **Aceptación:**
    - Integración del flujo completo DCR → token.
    - Tokens alterados, vencidos o sin `client_id` → 401.
  - **Verificar:** `pnpm test && pnpm test:e2e`.
  - **Archivos:** `src/pages/.well-known/oauth-protected-resource.ts`, `src/infrastructure/mcp/token-verifier.ts`, `src/pages/oauth/consent.astro`, `src/actions/oauth.ts`.

- [ ] **Tarea 31: Servidor MCP y herramientas** · M · Deps: 30
  - `/mcp` stateless con el SDK 1.x; las 14 tools sobre los casos de uso (`McpRpcLinkWriter`); `confirm_title`; rate limit; contenido marcado como datos.
  - **Aceptación:**
    - Tests de contrato con el cliente del SDK.
    - Un `confirm_title` incorrecto no borra.
  - **Verificar:** `pnpm test`; conexión manual desde Claude.
  - **Archivos:** `src/pages/mcp.ts`, `src/infrastructure/mcp/server.ts`, `src/infrastructure/mcp/tools/*.ts`, `src/infrastructure/mcp/mcp-rpc-link-writer.ts`.

- [ ] **Tarea 32: Conexiones de IA en el panel** · S · Deps: 31
  - `/admin/conexiones`: listar, cambiar permiso y revocar (`revokeGrant`).
  - **Aceptación:** E2E: revocar hace que la siguiente llamada dé 401.
  - **Verificar:** `pnpm test:e2e`; prueba manual desde Claude.
  - **Archivos:** `src/pages/admin/conexiones.astro`, `src/actions/connections.ts`.

### ✅ Checkpoint F8
- [ ] Desde Claude agregás un link y aparece en tu página; con solo lectura no puede modificar nada.
- [ ] Revisión con vos.

---

## Cierre

- [ ] **Tarea 33: Revisión final y publicación** · S · Deps: todas
  - `/security-review` sobre todo el repo, `/webperf` sobre la página pública, `/ship` (checklist de lanzamiento) y pasar el repo a público.
  - **Aceptación:**
    - Sin hallazgos altos abiertos.
    - Presupuestos en verde.
    - README de portfolio con la arquitectura y la estrategia de tests.
  - **Verificar:** informes de cada skill.
  - **Archivos:** `README.md`, `docs/`.
