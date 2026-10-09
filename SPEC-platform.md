# Spec: `platform`

> Módulo base del [mapa de capacidades](CAPABILITY-MAP.md). Define las
> convenciones que **todos** los demás specs heredan: comandos, estructura,
> estilo, testing, seguridad y límites. Estado: **aprobado (2026-10-09)**.

## Objetivo

Dejar un repo listo para construir el resto de los módulos con seguridad y
calidad desde el primer commit: Astro desplegado en Cloudflare, Supabase local
funcionando, tests de todos los niveles corriendo y una CI que bloquea merges
inseguros.

**Usuario:** vos como desarrollador (y, en el futuro, quien haga fork del repo).

**Éxito:** clonar el repo, correr tres comandos y tener la app andando en local
con tests en verde; cada push pasa por la CI; `main` se despliega solo.

## Supuestos

1. Windows 11 como entorno de desarrollo; Docker Desktop disponible (lo necesita Supabase local).
2. Un solo paquete (no monorepo). Si el MCP o los proveedores crecen, se extraen a `packages/` con un ADR.
3. Cuentas existentes de GitHub, Cloudflare y Supabase. El alta de secretos y DNS se guía con `wizard`.
4. TypeScript en modo `strict` en todo el código. **Riesgo:** TypeScript 7 (compilador nativo) puede no ser compatible todavía con `astro check` y `typescript-eslint`. Se verifica al armar el proyecto; si falla, se fija la última 6.x y se registra en un ADR.

## Stack y versiones

Las versiones exactas quedan fijadas en `pnpm-lock.yaml`. Regla: **última estable** al instalar.

| Herramienta | Versión de referencia (2026-10-09) |
|---|---|
| Node | 24 LTS (`.nvmrc`, `engines`) |
| pnpm | 12.x (campo `packageManager`, activado con Corepack) |
| Astro / `@astrojs/cloudflare` / `@astrojs/react` | 7.3 / 14.3 / 7.0 |
| React | 19.3 |
| Supabase JS / SSR / CLI | 2.117 / 0.12 / última |
| Zod | 4.6 |
| Wrangler | 4.x |
| Vitest / Playwright | 5.0 / 1.64 |
| ESLint (flat config) + `typescript-eslint` + `eslint-plugin-astro` · Prettier + `prettier-plugin-astro` | última estable |

## Comandos

```bash
pnpm install --frozen-lockfile   # instalar (en CI siempre con lockfile congelado)
pnpm dev                         # Astro en local, runtime workerd
pnpm db:start                    # supabase start (Postgres + Auth locales en Docker)
pnpm db:reset                    # aplica migraciones + seed.sql
pnpm db:types                    # supabase gen types typescript --local > src/infrastructure/supabase/database.types.ts
pnpm check                       # astro check + tsc --noEmit
pnpm lint                        # eslint . && prettier --check .
pnpm format                      # prettier --write .
pnpm test                        # vitest run (unit + integración)
pnpm test:coverage               # vitest run --coverage
pnpm test:db                     # supabase test db (pgTAP: RLS y funciones)
pnpm test:e2e                    # playwright test
pnpm audit:deps                  # pnpm audit --audit-level=high
pnpm build                       # astro build
pnpm preview                     # wrangler dev sobre el build
pnpm deploy                      # wrangler deploy (solo desde CI)
```

## Estructura del proyecto

Arquitectura de **puertos y adaptadores**: las reglas de negocio no conocen
Astro, Supabase ni Cloudflare. Así el panel, la API y el servidor MCP reutilizan
los mismos casos de uso, y se testean sin red.

```
src/
  domain/            → Entidades, value objects y schemas Zod. Funciones puras. Sin dependencias externas.
  application/       → Casos de uso (createLink, reorderLinks…). Dependen solo de interfaces (puertos).
    ports/           → Interfaces: LinkRepository, LiveStatusProvider, Clock, Logger…
  infrastructure/    → Adaptadores que implementan los puertos.
    supabase/        → Clientes, repositorios, tipos generados.
    providers/       → youtube/, twitch/ (uno por carpeta; misma interfaz).
    http/            → fetch seguro (timeouts, allowlist de hosts).
  composition/       → Composition root: arma las dependencias por request (inyección manual, sin framework de DI).
  ui/
    components/      → Componentes .astro sin estado.
    islands/         → Islas React (solo las que necesitan interactividad).
    styles/          → Tokens de diseño (vienen de brand-system).
  pages/             → Rutas Astro. Finas: validan entrada, llaman a un caso de uso y renderizan.
  actions/           → Astro Actions del panel (llaman a casos de uso).
  middleware.ts      → Sesión, cabeceras de seguridad, request id.
  worker.ts          → Entrada del Worker: fetch (Astro) + scheduled (cron).
supabase/
  migrations/        → SQL versionado. Toda tabla nace con RLS activado.
  tests/             → Tests pgTAP.
  seed.sql           → Datos de desarrollo (nunca datos reales).
tests/
  unit/              → Espejo de src/domain y src/application.
  integration/       → Adaptadores contra Supabase local y APIs mockeadas (MSW).
e2e/                 → Playwright: flujos completos y chequeos de seguridad.
docs/
  adr/               → Decisiones de arquitectura (0001-astro-sobre-nextjs.md, …).
.github/workflows/   → CI.
```

## Estilo de código

- TypeScript `strict`, `noUncheckedIndexedAccess`, sin `any` (se usa `unknown` y se valida con Zod).
- Nombres: archivos `kebab-case.ts`; tipos e interfaces `PascalCase`; funciones `camelCase` con verbo (`createLink`).
- **SOLID en la práctica:**
  - *S*: un caso de uso por archivo, una responsabilidad.
  - *O*: un proveedor nuevo (Kick) se agrega con una carpeta nueva, sin tocar los existentes.
  - *L*: todo `LiveStatusProvider` es intercambiable en los tests.
  - *I*: puertos chicos (`LinkReader` y `LinkWriter` separados si un consumidor solo lee).
  - *D*: `application/` depende de interfaces; las implementaciones se inyectan desde `composition/`.
- Errores esperables como valores (`Result`), no excepciones. Las excepciones quedan para lo inesperado.
- Comentarios solo para explicar el *por qué*.
- Conventional Commits (`feat(links): …`). Commits a tu nombre, sin coautoría.

```ts
// src/application/links/create-link.ts
import { LinkInput, type Link } from "@/domain/link";
import type { LinkWriter } from "@/application/ports/link-repository";
import { err, ok, type Result } from "@/domain/result";

export type CreateLinkError = "invalid_input" | "section_not_found";

export function createLink(deps: { links: LinkWriter }) {
  return async (ownerId: string, raw: unknown): Promise<Result<Link, CreateLinkError>> => {
    const parsed = LinkInput.safeParse(raw);
    if (!parsed.success) return err("invalid_input");

    // El dueño sale de la sesión, nunca del input: evita que un usuario escriba en datos ajenos.
    return deps.links.create({ ...parsed.data, ownerId });
  };
}
```

## Estrategia de testing

| Nivel | Herramienta | Qué cubre | Dónde |
|---|---|---|---|
| Unit | Vitest | Dominio y casos de uso con puertos falsos | `tests/unit/` |
| Integración | Vitest + Supabase local + MSW | Repositorios reales, proveedores con respuestas grabadas de YouTube/Twitch | `tests/integration/` |
| Base de datos | pgTAP (`supabase test db`) | **Cada política RLS**: anónimo, dueño, otro usuario, `service_role` | `supabase/tests/` |
| E2E | Playwright | Flujos completos, accesibilidad (axe) y cabeceras de seguridad | `e2e/` |

**Cobertura mínima:** 90 % en `domain/` y `application/`, 80 % global. Un PR no puede bajarla.

**Seguridad en los tests (obligatoria en cada módulo):**
- Toda entrada externa tiene un test con datos maliciosos: `javascript:` y `data:` en URLs, HTML/JS en títulos, strings enormes, Unicode raro.
- Toda tabla tiene tests de RLS para lectura y escritura con al menos tres roles.
- Todo endpoint autenticado tiene un test que lo llama sin sesión y con la sesión de otro usuario.
- E2E verifica CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS y `frame-ancestors`.
- Las llamadas salientes solo van a hosts de una allowlist (previene SSRF); hay un test que lo prueba.

Los bugs se arreglan con el patrón *Prove-It*: primero un test que falla, después el fix.

## Seguridad de la plataforma

- **CSP** con `security.csp` de Astro (hashes automáticos, sin `unsafe-inline` en scripts). Las cabeceras restantes se agregan en `middleware.ts`.
- **Secretos:** `wrangler secret` en producción y `.dev.vars` en local (en `.gitignore`); `.env.example` documenta cada variable. La `service_role` key de Supabase solo la usa el cron, nunca código que corre por request de usuario.
- **Dependencias:** Renovate con PRs agrupados; `pnpm audit` y revisión de dependencias en CI. Antes de sumar un paquete se audita (mantenimiento, descargas, scripts de instalación). pnpm bloquea los `postinstall` salvo los permitidos explícitamente.
- **CI** (GitHub Actions, en cada PR): `check` → `lint` → `test:coverage` → `test:db` → `build` → `test:e2e` → `audit:deps` → gitleaks → Semgrep (`p/owasp-top-ten`, `p/typescript`, `p/secrets`). Todos bloquean el merge. Las actions se fijan por SHA y los permisos del `GITHUB_TOKEN` son mínimos.
- **Rama `main` protegida:** solo entra por PR con CI en verde.

## Límites

- **Siempre:** usar pnpm; correr `check`, `lint` y `test` antes de cada commit; validar toda entrada con Zod en el borde; RLS en toda tabla nueva; escribir el test de seguridad junto con la feature; usar la última versión estable.
- **Preguntar antes:** sumar una dependencia; cambiar el esquema de la base; tocar la CI o las cabeceras de seguridad; subir una versión major; cualquier acción en Cloudflare, Supabase o GitHub que no sea local.
- **Nunca:** commitear secretos o `.dev.vars`; desactivar RLS, la CSP o un test para que algo pase; usar la `service_role` key en código que corre por request; usar npm o yarn; instalar versiones `beta`, `next` o `canary`; agregar líneas de coautoría a los commits.

## Criterios de éxito

- [ ] `pnpm install && pnpm db:start && pnpm dev` levanta la app en un clon limpio, siguiendo el README.
- [ ] Una página de prueba se despliega en Cloudflare desde `main` y responde con todas las cabeceras de seguridad (verificado por E2E).
- [ ] Hay al menos un test de cada nivel (unit, integración, pgTAP, E2E) y todos pasan en CI.
- [ ] La CI falla si se commitea un secreto de prueba, si una dependencia tiene una vulnerabilidad alta o si la cobertura baja del umbral.
- [ ] El cron (`scheduled`) corre en local con `wrangler dev --test-scheduled` y queda registrado en los logs.
- [ ] ADR 0001 (Astro + Cloudflare sobre Next.js + Vercel) escrito.

## Preguntas abiertas

1. ~~¿Docker instalado?~~ Sí: Docker 29.8, git 2.56 y gh 2.101 disponibles. pnpm local está en 11.25; se actualiza a 12 con Corepack.
2. ~~¿Repo?~~ Privado en GitHub (`juedsay/social-links-hub`, nombre provisorio). Se hace público después de la primera entrega usable con la CI en verde.
3. ~~¿Dominio?~~ Arrancamos en `*.workers.dev`. El dominio propio se decide junto con el nombre de la marca.
