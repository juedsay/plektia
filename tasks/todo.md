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

- [x] **Tarea 8: Sesión del servidor y rutas protegidas** · M · Deps: 7
  - Dominio: `Handle` y `safeRedirectPath`, con 15 o más casos maliciosos. Puerto `SessionReader` + adaptador con `getClaims()`, cliente de servidor con cookies `HttpOnly` y middleware que protege `/admin/*`.
  - **Aceptación:**
    - Unit e integración pasan (token válido, alterado y vencido).
    - `/admin` sin sesión redirige a `/login?next=`.
  - **Verificar:** `pnpm test`; E2E de redirección.
  - **Archivos:** `src/domain/handle.ts`, `src/infrastructure/http/safe-redirect.ts`, `src/application/ports/session-reader.ts`, `src/infrastructure/supabase/supabase-session-reader.ts`, `src/middleware/`.

- [x] **Tarea 9: Login con GitHub y Google** · M · Deps: 8
  - `wizard` para la OAuth App de GitHub y el cliente de Google. Páginas `/login`, `/auth/callback` y `/auth/logout`; rate limit; mensaje único de "sin acceso"; script `pnpm user:allow`. En E2E, la sesión de prueba sale de la API admin local.
  - **Migraciones en producción:** job en `deploy.yml` que corre `supabase db push` contra el proyecto en la nube antes de publicar el Worker, con el token de Supabase y la contraseña de la base en el entorno `production`. Incluye activar el hook `before_user_created` en el proyecto.
  - **Aceptación:**
    - Entrás con GitHub y con Google (prueba manual documentada).
    - Un correo no invitado no crea cuenta.
    - Los E2E de CSRF, cookies y rate limit pasan.
  - **Verificar:** `pnpm test:e2e`; prueba manual en el deploy.
  - **Archivos:** `src/pages/login.astro`, `src/pages/auth/callback.ts`, `src/pages/auth/logout.ts`, `scripts/allow-user.ts`, `e2e/auth.spec.ts`, `.github/workflows/deploy.yml`.

- [ ] **Tarea 9c: Aviso de vencimiento de tokens** · S · Deps: 9
  - Workflow semanal que abre un issue dos semanas antes de que venzan los tokens de la CI: `plektia-ci` de Supabase (90 días, ~13/01/2027) y el de Cloudflare (14/10/2027). Las fechas viven como variables del entorno `production`.
  - Script de renovación que guía la creación del token nuevo con los mismos permisos, lo verifica y lo guarda en GitHub.
  - **Aceptación:** con una fecha de vencimiento cercana, el workflow abre el issue (probado con `workflow_dispatch`).
  - **Archivos:** `.github/workflows/tokens.yml`, `scripts/renovar-token.sh`.

### ✅ Checkpoint F2
- [x] Entrás a `/admin` (vacío) en producción con tu cuenta; nadie más puede (hook en producción y pgTAP; queda la prueba manual con una cuenta no invitada).
- [ ] Revisión con vos.

---

## F3 · Links

- [x] **Tarea 10: Dominio de links** · M · Deps: 2
  - `parseSafeUrl` (30 o más casos, incluidos los maliciosos), `detectProvider` (host exacto), schemas Zod de link y sección, y el mapa de errores en español.
  - **Aceptación:** cobertura ≥ 90 %; los casos de la tabla de amenazas están cubiertos.
  - **Verificar:** `pnpm test:coverage`.
  - **Archivos:** `src/domain/safe-url.ts`, `src/domain/provider.ts`, `src/domain/link.ts`, `src/domain/section.ts`, `src/domain/errors.ts`, `src/domain/text.ts`.

- [x] **Tarea 11: Esquema de links con RLS y operaciones atómicas** · M · Deps: 7
  - Tablas `sections` y `links`, índices, triggers (dueño de la sección, límites, recolocar al borrar), RPC `reorder_sections` y `move_links`, y políticas RLS (con la condición `client_id is null` en escrituras, preparada para el MCP).
  - **Aceptación:** pgTAP de todas las políticas con 4 roles, de los triggers, de la atomicidad y de los `check` de URL.
  - **Verificar:** `pnpm test:db`.
  - **Archivos:** `supabase/migrations/20261016000000_links.sql`, `supabase/tests/0002_links.test.sql`, `supabase/tests/0003_links_rpc.test.sql`.

- [x] **Tarea 12: Casos de uso y repositorio** · M · Deps: 10, 11
  - Puertos `LinkReader` y `LinkWriter`, los casos de uso de links y secciones, y `SupabaseLinkRepository` con `version` optimista.
  - **Aceptación:**
    - Unit con puertos falsos.
    - Integración contra Supabase local, incluido el `conflict` con dos updates.
    - Reorden aleatorio repetido sin duplicados.
  - **Verificar:** `pnpm test`.
  - **Archivos:** `src/application/ports/link-repository.ts`, `src/application/links/*.ts`, `src/application/sections/*.ts`, `src/infrastructure/supabase/supabase-link-repository.ts`.

- [x] **Tarea 13: Vista pública y seed** · S · Deps: 12
  - `public_page_v` (`security_invoker`) + `get-public-page` + seed con tus secciones y links reales.
  - **Aceptación:**
    - Una sola consulta devuelve la página.
    - Lo oculto no aparece para `anon` (pgTAP).
  - **Verificar:** `pnpm test:db && pnpm test`.
  - **Archivos:** `supabase/migrations/20261016100000_public_page.sql`, `src/application/public/get-public-page.ts`, `src/infrastructure/supabase/supabase-public-page-reader.ts`, `supabase/seed.sql`.

### ✅ Checkpoint F3
- [ ] Todo el núcleo con RLS probado; cada amenaza de `links` con su test en verde.
- [ ] Revisión con vos.

---

## F4 · Public page → ENTREGA 1

- [x] **Tarea 14: Página `/{handle}` desde el prototipo** · M · Deps: 13
  - Portar tokens, estilos y componentes Astro (`ProfileHeader`, `Bank`, `Port`, `LatestVideo`, `Footer`). Rutas `[handle]`, `/` (`DEFAULT_HANDLE`) y 404.
  - Migración `profiles.show_handle` (por defecto `true`) expuesta en `public_page_v`; el encabezado muestra `@handle` según ese valor.
  - **Aceptación:** la comparación visual con el prototipo a 390 y 1440 px, con la semilla del hilo fija, pasa.
  - **Verificar:** `pnpm test:e2e` (capturas de referencia).
  - **Hecho:** estructura, estilos, rutas, 404 y `show_handle`, con E2E de contenido, orden, `rel="me"`, canónica, 404 y cero pedidos a terceros. La comparación visual con semilla fija pasa a la tarea 15, junto con el hilo que la necesita. El avatar muestra la inicial hasta la tarea 22, y el bloque de "último video" llega con `live-status`.
  - **Archivos:** `src/pages/[handle].astro`, `src/pages/index.astro`, `src/pages/404.astro`, `src/ui/components/*.astro`, `src/ui/styles/*.css`.

- [x] **Tarea 15: Scripts del hilo, del video y de compartir en TypeScript** · M · Deps: 14
  - `thread.ts`, `disclosure.ts` y `share.ts` tipados, con la semilla configurable solo en tests.
  - **Aceptación:**
    - Un test con 1.000 semillas confirma que el hilo nunca entra en la columna de texto.
    - El disclosure funciona con teclado.
    - El fallback de compartir copia el link.
  - **Verificar:** `pnpm test` + E2E.
  - **Archivos:** `src/ui/scripts/thread.ts`, `src/ui/scripts/disclosure.ts`, `src/ui/scripts/share.ts`, `tests/unit/ui/thread.test.ts`.
  - **Hecho:**
    - **Geometría del hilo:** quedó en `thread-geometry.ts`, que es puro. El test de 1.000 semillas detectó que el nudo del prototipo podía invadir la columna del texto; ahora el inicio se corre para que entre. Las dos mutaciones probadas hacen fallar el test.
    - **Comparación visual:** las capturas pixel a pixel no se usan, porque cambian entre Windows (local) y Linux (CI), y otra vez cuando llegue la fuente propia (tarea 16). En su lugar hay un E2E en navegador real, a 390 y 1440 px y con semilla fija, que mide que el hilo no pasa el borde del texto y que la misma semilla da el mismo hilo.
    - **Desplegable:** probado con unit, y al ser un `<button>` nativo funciona con teclado. Su E2E llega con el bloque "último video" de `live-status`, que es lo que lo usa.

- [ ] **Tarea 16: Fuente propia, SEO y páginas de Plektia** · M · Deps: 14
  - **Landing simple en `/`** (una pantalla: qué es Plektia, ejemplo de página, "por ahora, por invitación", links a `/plektia` y a entrar). Reemplaza el perfil de `DEFAULT_HANDLE` en la raíz, y la variable se elimina.
  - `@fontsource-variable/bricolage-grotesque` (solo subset latino), métricas de respaldo, metadatos, OG, JSON-LD `ProfilePage`, sitemap, robots, y las páginas `/plektia` (página oficial con el diseño de perfil y contenido en `src/content/plektia.ts`, validado con los schemas del dominio) y `/legal/privacy`.
  - **Aceptación:**
    - Cero requests a Google al cargar.
    - Validadores de metadatos sin errores.
    - La política de privacidad refleja lo implementado.
    - La información de marca de Google está completa (página principal, política de privacidad y dominios autorizados: `plektia.workers.dev` y el de Supabase).
    - La app de Google **sigue en "Prueba"** a propósito: la pantalla de consentimiento muestra el correo de asistencia, y aparece antes de que Plektia rechace a quien no está invitado. Cada persona invitada que entre con Google se carga como usuario de prueba (hasta 100). La publicación pasa a la apertura del registro (v2).
  - **Verificar:** E2E de red; Rich Results Test manual.
  - **Parte 1 (hecha):**
    - Fuente propia con la API de fuentes de Astro: solo el subset latino con eje óptico, precarga y respaldo con métricas.
    - Open Graph, Twitter Card, JSON-LD `ProfilePage` (escapado contra inyección), favicon, ícono de iOS e imagen OG (`scripts/brand-images.ts`), sitemap y robots.
  - **Parte 2 (hecha):**
    - Landing simple en `/`, con las salidas en un banco con hilo.
    - `/plektia`, la página oficial: contenido en `src/content/` validado con `parseLinkInput` (lo que el panel rechazaría rompe el build); bio "Todos tus links, unidos por un hilo.".
    - Se eliminó `DEFAULT_HANDLE`.
    - Las páginas se renderizan en el Worker, no prerenderizadas, para que tengan las cabeceras de seguridad.
  - **Parte 3 (código hecho; falta el wizard de Turnstile y la clave de servicio en producción):** formulario de contacto en `/contact`, en la raíz y no bajo `/plektia`, a pedido. `contacto` y `privacidad` pasan a ser handles reservados.
    - Tabla `contact_messages` con RLS: solo inserta el visitante; solo leen los owners.
    - Caso de uso con validación, campo trampa, límite por IP (binding propio) y Turnstile verificado en el servidor (*sitekey* y *secret* se crean con un wizard).
    - Aviso por mail cuando haya dominio propio.
    - El correo de Plektia nunca aparece en el sitio.
  - **Mejoras del formulario (hechas):** validación en el navegador con las reglas del dominio, botón bloqueado al enviar, avisos que reciben el foco, borrador por pestaña y éxito con "Volver al inicio" / "Enviar otro mensaje" (sin redirección automática, por accesibilidad). El login pasa al diseño de Plektia, y un E2E revisa que ninguna página se desborde entre 360 y 1440 px.
  - **Parte 4:** política de privacidad en `/legal/privacy` (rutas propias en inglés; `/legal` agrupa los documentos legales que lleguen en v2: términos, uso aceptable, denuncias), enlazada en el pie de todas las páginas. Después, la publicación de la app de Google.
  - **Archivos:** `src/ui/styles/fonts.css`, `src/ui/components/Seo.astro`, `src/content/plektia.ts`, `src/pages/plektia/index.astro`, `src/pages/legal/privacy.astro`, `src/pages/sitemap.xml.ts`.

- [x] **Tarea 16b: Ventana de compartir propia** · S · Deps: 16
  - `<dialog>` nativo con el diseño de Plektia, como la de Linktree:
    - tarjeta de vista previa (avatar, nombre y `/handle`);
    - Copiar link, WhatsApp, X, Facebook, LinkedIn, Telegram y Email, como links de intención que se abren al tocarlos (cero pedidos a terceros al cargar);
    - "Más opciones", que abre la hoja del sistema si existe;
    - aviso "Conocé Plektia" al pie.
  - **Aceptación:**
    - Se cierra con Esc y al tocar afuera, y el foco vuelve al botón.
    - axe AAA sin errores.
    - Cada destino arma su URL con el link codificado.
  - **Verificar:** unit de las URLs de cada destino + E2E de teclado y foco.
  - **Archivos:** `src/ui/components/ShareDialog.astro`, `src/ui/view/share-targets.ts`, `src/ui/scripts/share.ts`.
  - **Hecho:**
    - En el celular es una hoja que sube desde abajo, y en desktop una tarjeta centrada.
    - Los logos de marca salen de `simple-icons` 16.34.0 (CC0, auditado). LinkedIn ya no está en ese paquete y usa un "in" genérico.
    - Se comparte la URL canónica, sin los parámetros de la visita.
    - El foco vuelve al botón también en Safari.
    - La prueba de axe AAA pasa a la tarea 17, que suma axe a los E2E de todas las páginas.

- [x] **Tarea 17: Caché, rendimiento y accesibilidad** · M · Deps: 15, 16, 16b
  - `Cache-Control` + `Cache-Tag` y el helper `purgeProfile(handle)`. Lighthouse CI con los presupuestos del spec, axe AAA en E2E, y tests de "sin cookies" y "sin terceros".
  - **Aceptación:** todos los presupuestos y AAA en verde en CI.
  - **Verificar:** CI.
  - **Archivos:** `src/infrastructure/cache/purge.ts`, `lighthouserc.json`, `e2e/public-page.spec.ts`, `e2e/a11y.spec.ts`.
  - **Parte 1, caché (hecha):** política por respuesta con un middleware, `WorkerPageCache` para purgar por etiqueta, caché activada y E2E de cabeceras y "sin cookies". El `HIT` se prueba contra producción en cada deploy. Desvíos y notas en el ADR 0003.
  - **Parte 2, accesibilidad (hecha):** axe (`@axe-core/playwright` 4.13.0, auditado) con reglas WCAG 2.2 hasta AAA en las 7 páginas públicas y en 4 estados: compartir abierto, contacto con errores, envío exitoso y login rechazado. Cero violaciones; una prueba de mutación confirmó que axe detecta un contraste solo AA y un botón sin nombre. Turnstile (iframe de Cloudflare) queda afuera.
  - **Parte 3, rendimiento (hecha):**
    - `scripts/lighthouse.ts` (`pnpm perf`) corre Lighthouse 13.5.0 (auditado; sin `@lhci/cli`, que estaba abandonado y con dependencias viejas) sobre 5 páginas, incluido un perfil de 50 links del seed. Falla si se excede un presupuesto, y corre en el job de E2E.
    - Optimizaciones que salieron de medir:
      - CSS en línea (ya no bloquea el render);
      - el enhebrado calcula la forma una sola vez y en cada cuadro solo mueve el recorte;
      - el trenzado se calcula con matemática sobre las curvas en lugar de `getPointAtLength`, que tenía costo cuadrático: el TBT del perfil de 50 links bajó de 7,8 s a 0.
    - Resultado: 100 en las cuatro categorías, LCP de alrededor de 1,1 s, TBT 0, JS 3,1 KB y HTML 7,6 KB con 50 links.
    - El CLS queda en ≤ 0,001, por el cambio de fuente (documentado en la spec).
    - El LCP pasa a ≤ 1,8 s para conservar la fuente con eje óptico (decisión revisable, documentada en la spec). Cada página se mide 3 veces y se usa la mediana, porque una sola medición varía demasiado.

### ✅ Checkpoint F4 · ENTREGA 1
- [ ] `https://<tu-worker>.workers.dev/juedsay` online con tus links (cargados por seed). Ya la podés poner en tu bio.
- [ ] Revisión con vos; evaluar si hacemos el repo público.

---

## F5 · Admin panel → ENTREGA 2

- [x] **Tarea 17c: Una cuenta, varias páginas** · M · Deps: 13
  - Decisión del 2026-10-22: **una cuenta con varias páginas** (como Linktree), con un selector en el panel. Se descartó la variante de Instagram (varias cuentas con emails distintos y cambio de sesión), por complejidad y superficie de ataque.
  - Se separa "usuario" de "página" en la base: `pages` (handle, nombre, bio, avatar, tema, `show_handle`) pasa a ser la dueña de secciones y links; `profiles` queda para la persona (rol, alta y baja). Hay que migrar los datos existentes y actualizar la vista pública, RLS, RPCs, casos de uso, invitaciones y el `user:allow`.
  - Va antes de construir el panel, para no rehacerlo. La página pública sigue en `/{handle}`.
  - **Decidido (2026-10-22):** hasta **3 páginas por cuenta**, y el panel abre **la última página usada**. Los managers con permisos delegados quedan para la v2. Spec: [SPEC-pages.md](../SPEC-pages.md).
  - **Entregas:**
    1. Spec (#36).
    2. Migración + pgTAP + vista pública + tipos; el repositorio de links pasa a trabajar por página (#37).
    3. Repositorio y casos de uso de páginas (`createPage`, `listPages`, `selectPage`); seed con una segunda página (`/demo-segunda`, con datos ficticios).
  - **Para la tarea 18:** el panel resuelve la página actual con `listPages` y arma `SupabaseLinkRepository(client, pageId)` con ella; elegir otra página llama a `selectPage`.
  - **Aceptación:**
    - Una cuenta crea una segunda página con otro handle y cada una muestra solo sus links.
    - RLS: nadie edita páginas que no son suyas.
    - La migración conserva tu página actual sin cambios visibles.

- [x] **Tarea 18: Estructura del panel y perfil** · M · Deps: 9, 12, 17c
  - Layout y navegación de `/admin` (diseño con impeccable en modo *operate*), y `/admin/page` (nombre, bio, tema y mostrar u ocultar el `@handle` de la página elegida) con Actions.
  - Incluye el selector de página (tarea 17c).
  - **Decidido (2026-10-22):**
    - La pantalla se llama `/admin/page` ("Página" en la navegación), porque desde la 17c el nombre, la bio y el tema son de cada página. Ruta en inglés, como `/contact`.
    - Estilos: CSS plano con los tokens de `tokens.css`, igual que la página pública. **Tailwind se integra más adelante** para optimizar y agilizar el panel; queda anotado en la hoja de ruta.
  - **Entregas:** (a) layout, navegación y selector de página; (b) `/admin/page` con su Action y purga de caché.
  - **Aceptación:**
    - Editar el nombre se refleja en la página pública.
    - E2E de CSRF y axe AA.
  - **Verificar:** `pnpm test:e2e`.
  - **Archivos:** `src/ui/layouts/AdminLayout.astro`, `src/pages/admin/page.astro`, `src/actions/pages.ts`, `src/application/pages/update-page.ts`.

- [x] **Tarea 18c: Vista de escritorio para las páginas del sitio** · S · Deps: 16
  - Pedido del 2026-10-23: la landing (`/`), contacto, login, `/legal/*` y la 404 se adaptan a escritorio (más ancho, composición de dos columnas donde sirva) además del celular.
  - Las páginas de links (`/{handle}` y `/plektia`) siguen siendo **solo vista mobile**: una columna de 30rem centrada en cualquier pantalla.
  - **Aceptación:** capturas a 390 y 1440 px de cada página; `responsive.spec.ts` sin desbordes; axe AAA y Lighthouse sin cambios en las páginas de links.

- [x] **Tarea 19: Editor, edición en el lugar con guardado instantáneo** · M · Deps: 18
  - Isla `Editor`: listar, crear, editar y ocultar links, y "Deshacer" de 6 s. Borrado diferido con `keepalive`. Aviso de conflicto por `version`.
  - **Aceptación:** tests de componentes y E2E de crear, editar, ocultar y deshacer.
  - **Verificar:** `pnpm test && pnpm test:e2e`.
  - **Archivos:** `src/ui/islands/Editor.tsx`, `src/ui/islands/editor/*.tsx`, `src/actions/links.ts`, `src/pages/admin/index.astro`.

- [x] **Tarea 20: Ordenar y gestionar secciones** · M · Deps: 19
  - `@dnd-kit` con mouse, toque y **teclado**, con anuncios; mover entre secciones; crear, renombrar, ocultar, mostrar u ocultar el título y borrar secciones.
  - **Aceptación:** E2E de ordenar con mouse y con teclado; el lector de pantalla anuncia los movimientos.
  - **Verificar:** `pnpm test:e2e`.
  - **Archivos:** `src/ui/islands/editor/SortableList.tsx`, `src/ui/islands/editor/SectionHeader.tsx`, `src/actions/sections.ts`.

- [x] **Tarea 21: Vista previa en vivo y purga** · S · Deps: 19, 17
  - `/admin/vista-previa` (con `frame-ancestors 'self'`) en un iframe; las Actions purgan la caché del perfil.
  - **Aceptación:** el cambio se ve en la vista previa en menos de 1 s y en la página pública en menos de 5 s.
  - **Verificar:** E2E.
  - **Archivos:** `src/pages/admin/vista-previa.astro`, `src/actions/*.ts`.

- [x] **Tarea 21b: /plektia en la base y la cuenta Admin** · M · Deps: 21
  - Decisión del 2026-10-23: el sitio lo administra una **cuenta Admin propia de Plektia** (rol `owner`), separada de la cuenta personal.
  - **Admin:** edita las novedades del sitio y la página `/plektia` desde el panel, con el mismo editor de links. `/plektia` pasa del repo (`src/content/plektia.ts`) a ser una página en la base de esa cuenta; el handle reservado `plektia` se le permite solo a ella.
  - **Cuenta personal (juedsay):** conserva `/juedsay` con sus links y puede sumar hasta 3 páginas (por ejemplo, stream o contenido, y profesional). Sigue como `owner` por las dudas (decisión del 2026-10-28, abajo).
  - **Pasos en producción** (con confirmación): invitar al email de Plektia como `owner` con `/plektia` como su primera página y cargar el contenido. El email nuevo se agrega como usuario de prueba en la app de Google (sigue en "Prueba").
  - **Usuario de prueba:** ya invitado el 2026-10-23 como `member` con `/user-test`.
  - **Código (hecho):** migración `official_page` (`plektia` solo para una cuenta `owner`, en invitaciones y páginas; quien la tiene no deja de ser owner), `/plektia` lee la base y, mientras no exista ahí, muestra el contenido del repo; caché con la etiqueta `profile:plektia`; seed con `admin@plektia.test`.
  - **Producción (hecho, 2026-10-28):** (1) invitación de la cuenta Admin como `owner` con `/plektia`; (2) la cuenta Admin entró con Google; (3) contenido de `/plektia` cargado con un script revisado, a pedido (las mismas 3 secciones y 5 links; desde ahí se edita en el panel); (4) borrado `src/content/plektia.ts` y el respaldo de la página.
  - **Decisión del 2026-10-28:** la cuenta personal **sigue como `owner`** por las dudas (no baja a `member`).
  - **Aceptación:** la Admin edita `/plektia` desde el panel y se ve al instante; las dos cuentas son `owner` y `/plektia` es solo de la Admin; pgTAP de que `plektia` solo lo puede tener una cuenta `owner`.

- [x] **Tarea 22: Avatar** · M · Deps: 18
  - Recorte y WebP en el navegador; validación en el servidor (*magic bytes*, tamaño y peso); bucket `avatars` con sus políticas.
  - **Aceptación:**
    - Integración: SVG, PNG renombrado, 10 MB y 4000 px → todos rechazados.
    - Las políticas de Storage, probadas con dos usuarios.
  - **Verificar:** `pnpm test`.
  - **22a (servidor, hecho):** migración `avatars` (bucket, políticas, check de `pages.avatar_path`, `avatars` reservado), `inspectAvatar` (magic bytes, 512 × 512, ≤ 200 KB, sin animación ni EXIF/XMP, sin bytes de más), `setPageAvatar` y `removePageAvatar`, Actions `pages.setAvatar` y `pages.removeAvatar`, `/avatars/...` desde el propio sitio y la foto en la página pública.
  - **22b (servidor, hecho):** JPEG además de WebP (Safari no genera WebP), validado por toda su estructura y sin metadatos; límite del cuerpo de los pedidos (413/411) antes de leerlo; `/avatars` re-valida lo que trae de Storage y responde con CSP `sandbox`; una sola regla para `pages.avatar_path`.
  - **22c (hecho):** en `/admin/page`, elegir la foto (tipo real por sus bytes, ≤ 5 MB, ≤ 8000 px por lado y ≤ 40 MP leídos de la cabecera antes de decodificar), recortarla en cuadrado (arrastrar, flechas, zoom con barra o con más y menos), re-codificarla a WebP o JPEG de 512 × 512 en el navegador (sin EXIF) y subirla con un solo envío a la vez; sacar el avatar con un formulario sin JavaScript; E2E de la subida real con una cuenta propia del seed.
  - **Archivos:** `src/domain/avatar.ts`, `src/application/pages/set-page-avatar.ts`, `src/infrastructure/supabase/supabase-avatar-storage.ts`, `src/infrastructure/supabase/avatar-images.ts`, `src/pages/avatars/[owner]/[file].ts`, `supabase/migrations/20261029000000_avatars.sql`.

- [x] **Tarea 23: Usuarios habilitados (owner)** · M · Deps: 18
  - Funciones `admin_invite`, `admin_revoke` y `admin_list_users` (`security definer` con chequeo de rol), `profiles.disabled` en RLS, `private.audit_log` y la UI `/admin/usuarios`.
  - **Aceptación:**
    - pgTAP: un `member` no puede; no se puede revocar al último owner.
    - E2E: invitar y revocar.
  - **Verificar:** `pnpm test:db && pnpm test:e2e`.
  - **Archivos:** `supabase/migrations/0005_admin.sql`, `src/application/admin/*.ts`, `src/pages/admin/usuarios.astro`, `src/actions/users.ts`.
  - **Hecho (2026-10-28):** funciones `admin_invite`, `admin_revoke` (nadie se quita el acceso a sí mismo, así nunca queda sin owner; devuelve las páginas para purgar la caché) y `admin_list_users`, con `private.audit_log`; `/admin/usuarios` (404 para quien no es owner activo), Actions `users.invite` y `users.revoke`, link en la navegación solo para owners y aviso en el panel para una cuenta dada de baja. `pnpm user:allow` queda como alternativa.

### ✅ Checkpoint F5 · ENTREGA 2
- [ ] Armás y ordenás tu página entera desde el celular.
- [ ] Revisión con vos.

---

## F6 · Live status → ENTREGA 3

- [x] **Tarea 24: Configuración de medios por link** · M · Deps: 20
  - `link_media_settings` + UI en el editor: "Transmito en este canal" y el contenido destacado (último video, Short, stream o fijado).
  - **Aceptación:** pgTAP (owner) y E2E de los interruptores.
  - **Verificar:** `pnpm test:db && pnpm test:e2e`.
  - **Archivos:** `supabase/migrations/0006_live.sql`, `src/ui/islands/editor/MediaSettings.tsx`, `src/actions/media.ts`.
  - **Hecho (2026-10-28):** tabla `link_media_settings` (RLS del dueño, sin lectura pública por ahora; un trigger saca el dueño del link y rechaza cada opción en un link que no la admite; si el link cambia de proveedor o deja de ser un canal, se borra). Actions `links.getMedia` y `links.setMedia` (upsert de la configuración completa: repetir el pedido deja lo mismo). En el editor, `MediaSettings` dentro de la fila del link: "Transmito en este canal" para canales de YouTube, Twitch o Kick, y "Contenido destacado" para canales de YouTube; "Fijado" guarda solo el ID del video. Todavía no cambia la página pública: lo usan las tareas 25 y 26.

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

- [ ] **Tarea 32b: Aviso por mail de los mensajes de contacto** · S · Deps: 16 (parte 3)
  - Cada mensaje nuevo de `/contact` te llega por mail, sin exponer el correo en el sitio.
  - Con dominio propio, se usa el servicio de email de Cloudflare (sin terceros). Si el dominio no llegó, se usa un servicio externo (por ejemplo Resend), que manda solo a tu correo.
  - **Aceptación:**
    - Un envío real llega al mail con nombre, email y mensaje, sin HTML del visitante (se manda solo texto).
    - Si el mail falla, el mensaje queda guardado igual.
  - **Verificar:** integración con el proveedor en modo prueba + un envío real.

- [ ] **Tarea 33: Revisión final y publicación** · S · Deps: todas
  - `/security-review` sobre todo el repo, `/webperf` sobre la página pública, `/ship` (checklist de lanzamiento) y pasar el repo a público.
  - **Aceptación:**
    - Sin hallazgos altos abiertos.
    - Presupuestos en verde.
    - README de portfolio con la arquitectura y la estrategia de tests.
  - **Verificar:** informes de cada skill.
  - **Archivos:** `README.md`, `docs/`.
