# Plektia

Página personal de links y redes sociales con detección de transmisiones en
vivo (YouTube, Twitch), último video de YouTube, panel de edición y servidor
MCP para gestionarla desde un agente de IA.

> En desarrollo. El alcance y las decisiones están en
> [CAPABILITY-MAP.md](CAPABILITY-MAP.md), los `SPEC-*.md` de cada módulo,
> [DESIGN.md](DESIGN.md) y [docs/adr/](docs/adr/). El avance está en
> [tasks/todo.md](tasks/todo.md).

## Stack

Astro 7 · React 19 (islas) · Cloudflare Workers · Supabase (Postgres + RLS +
Auth) · Zod · Vitest · Playwright · TypeScript 6 · pnpm 11.

## Calidad y seguridad

Cada PR pasa por la [CI](.github/workflows/ci.yml) y no se puede mergear a `main` si algo falla:

- **Tipos, lint, tests unitarios y build**, con cobertura mínima de 90 % en reglas de negocio y 80 % global.
- **Base de datos:** tests pgTAP de cada política RLS y asesores de seguridad de Supabase.
- **E2E** con Playwright contra el build de producción, incluidas las cabeceras de seguridad y un intento de XSS.
- **Seguridad:** `pnpm audit`, gitleaks sobre todo el historial y Semgrep (OWASP Top Ten, TypeScript, secretos y [reglas propias](.semgrep/rules/) con sus tests).

Las dependencias las actualiza Renovate en PRs agrupados que pasan por la misma CI.

## Requisitos

- Node 24 (ver `.nvmrc`).
- pnpm 11, activado con Corepack: `corepack enable` (la versión exacta sale de `packageManager`).
- Docker Desktop (para Supabase local).

## Levantar el proyecto

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm db:start   # Supabase local en Docker (puertos 566xx)
pnpm db:reset   # aplica migraciones y seed
pnpm env:local  # genera .dev.vars con las claves de Supabase local
pnpm dev
```

La app queda en `http://127.0.0.1:4321`, corriendo en workerd (el runtime de Cloudflare Workers).

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo en workerd |
| `pnpm check` | Chequeo de tipos (`astro check` + `tsc`) |
| `pnpm build` | Build de producción en `dist/` |
| `pnpm preview` | Sirve el build localmente |
| `pnpm lint` | ESLint (TypeScript estricto, Astro y accesibilidad) + Prettier |
| `pnpm format` | Formatea con Prettier |
| `pnpm test` | Tests unitarios y de integración (Vitest, incluye chequeo de tipos) |
| `pnpm test:coverage` | Tests con cobertura: falla por debajo de 90 % en `domain`/`application` y 80 % global |
| `pnpm test:e2e` | E2E con Playwright contra el build de producción (en local usa Microsoft Edge) |
| `pnpm db:start` / `pnpm db:stop` | Levanta o frena Supabase local (Studio en `http://127.0.0.1:56623`) |
| `pnpm db:reset` | Recrea la base local con las migraciones y `supabase/seed.sql` |
| `pnpm test:db` | Tests pgTAP de la base (RLS, funciones y permisos) |
| `pnpm test:integration` | Tests de integración contra Supabase local (sesión: token válido, alterado y vencido) |
| `pnpm db:types` | Genera los tipos de TypeScript desde el esquema local |
| `pnpm db:advisors` | Asesores de seguridad y rendimiento de Supabase; falla ante advertencias |
| `pnpm env:local` | Genera `.dev.vars` (ignorado por git) con las claves de Supabase local |
| `pnpm user:allow <email> <handle> [--role owner] [--prod]` | Invita a una persona (allowlist). Sin `--prod`, en la base local |
| `pnpm deploy:worker` | Publica el build en Cloudflare (lo corre la CI; ver [Deploy](#deploy)) |

## Deploy

Producción: **https://app.plektia.workers.dev** (Cloudflare Workers).

Cada merge a `main` se publica solo: cuando la [CI](.github/workflows/ci.yml) pasa, el
[workflow de deploy](.github/workflows/deploy.yml) compila ese mismo commit, lo publica con
`wrangler deploy` y corre los E2E de cabeceras de seguridad contra la URL real. El token de
Cloudflare vive en el entorno `production` de GitHub, solo puede editar el Worker `app`
y ningún otro job lo ve.

El cron (`scheduled` en [src/worker.ts](src/worker.ts)) corre cada 5 minutos. Para probarlo
en local, después de `pnpm build`:

```bash
pnpm exec wrangler dev -c dist/server/wrangler.json --test-scheduled
curl "http://127.0.0.1:8787/cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*"
```

Para configurar un deploy desde cero (otra cuenta o un fork), el
[wizard](scripts/wizard-deploy.sh) guía cada paso manual: login en Cloudflare, primer deploy,
token de CI con permisos mínimos, secretos en GitHub y proyecto de Supabase. En Windows se
corre con el bash de Git:

```bash
& "C:\Program Files\Git\bin\bash.exe" scripts/wizard-deploy.sh
```
