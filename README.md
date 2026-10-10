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

## Requisitos

- Node 24 (ver `.nvmrc`).
- pnpm 11, activado con Corepack: `corepack enable` (la versión exacta sale de `packageManager`).
- Docker Desktop (para Supabase local, desde la tarea 3).

## Levantar el proyecto

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .dev.vars
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

Los comandos de base de datos, E2E y deploy se suman en las tareas 3 a 6 (ver [SPEC-platform.md](SPEC-platform.md)).
