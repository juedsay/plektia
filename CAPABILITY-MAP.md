# Mapa de capacidades — App de links y redes sociales

> Estado: **aprobado (2026-10-09)**. Cada módulo tiene su propio
> `SPEC-<id>.md`. Los ids son estables: no se renombran.

## Decisiones transversales

- **Gestor de paquetes:** pnpm (nunca npm/yarn). Versión fijada en `packageManager`.
- **Versiones:** siempre la última estable (no `next`/`beta`/`canary`) al momento de instalar; las majors se suben con un PR propio.
- **Calidad:** principios SOLID y arquitectura de puertos y adaptadores; la seguridad se revisa en cada spec, test y review.
- **Login:** GitHub y Google OAuth. **Registro cerrado**: solo entra quien el admin da de alta.
- **URLs:** `/{handle}` es la ruta canónica; la raíz del dominio es la landing de Plektia, y `/plektia`, la página oficial de la marca.
- **Repo:** GitHub **público** ([juedsay/plektia](https://github.com/juedsay/plektia)); `main` solo acepta PRs con la CI en verde.

## Stack

Versiones estables verificadas en npm el 2026-10-09:

| Capa | Elección | Motivo |
|---|---|---|
| Runtime | Node 24 LTS · pnpm 11 · TypeScript 6 | Ver [ADR 0002](docs/adr/0002-versiones-typescript-pnpm.md) |
| Framework | **Astro 7.3** + islas React 19 solo donde hace falta (panel, drag & drop) | La página pública es casi toda estática: 0 KB de JS por defecto, mejor LCP. Server Islands para el bloque "en vivo" sin romper la caché de la página. |
| Hosting | **Cloudflare Workers** (`@astrojs/cloudflare` 14) | Cloudflare mantiene Astro desde 2026; Cron Triggers cada pocos minutos en el plan gratuito (en Vercel Hobby son diarios). |
| Datos y auth | **Supabase** (Postgres + RLS + Auth + OAuth 2.1 server) | RLS aísla datos por usuario desde la base; el OAuth server autentica clientes MCP. |
| Validación | Zod 4 (compartido entre panel, API y MCP) | Una sola definición de "link válido". |
| MCP | `@modelcontextprotocol/sdk` 1.x (Streamable HTTP) | |
| Tests | Vitest 5 · pgTAP (políticas RLS) · Playwright 1.64 | Ver `SPEC-platform.md`. |
| CI | GitHub Actions: typecheck, lint, tests, `pnpm audit`, gitleaks, Semgrep | |

## Módulos

| Id | Responsabilidad | Depende de |
|---|---|---|
| `brand-system` | Naming, logotipo, isotipo, imagotipo, paleta, tipografía, tokens de diseño, componentes base | — |
| `platform` | Repo, Astro + Cloudflare, Supabase local, CI, arnés de tests, cabeceras de seguridad (CSP) | — |
| `identity` | Login con GitHub/Google, registro cerrado (allowlist), sesiones, protección de rutas, perfil de usuario (`handle`) | `platform` |
| `links` | Modelo de datos: perfil, secciones, links, etiquetas (guardadas, sin UI de filtro). CRUD, orden, RLS | `identity` |
| `admin-panel` | UI de edición: crear/editar/borrar; reordenar arrastrando links y secciones, mover links entre secciones, crear/renombrar/ocultar secciones y mostrar u ocultar sus títulos; vista previa | `links`, `brand-system` |
| `public-page` | Página pública `/{handle}`: render estático, SEO, Open Graph, accesibilidad | `links`, `brand-system` |
| `live-status` | Proveedores YouTube y Twitch: estado en vivo + último video de YouTube. Cron + caché. Interfaz de proveedor extensible (Kick en v2) | `links` |
| `click-analytics` | Conteo de clics por link, sin cookies ni datos personales; vista en el panel | `public-page`, `admin-panel` |
| `mcp-server` | Endpoint MCP remoto con OAuth (Supabase OAuth server): herramientas para listar, crear, editar, borrar y reordenar links | `identity`, `links` |

## Orden de construcción

```
brand-system ─────────────────────────────┐
platform → identity → links → public-page ┼→ click-analytics
                          ├→ admin-panel ─┘
                          ├→ live-status
                          └→ mcp-server
```

1. `platform` → `identity` → `links` (en paralelo: `brand-system`)
2. `public-page` → **primera entrega usable**: tu página online con links cargados por SQL/seed
3. `admin-panel` → **segunda entrega**: editás desde la web
4. `live-status` → **tercera entrega**: punto rojo y último video
5. `mcp-server` y `click-analytics`

## Hoja de ruta (después de la v1)

| Versión | Idea | Notas |
|---|---|---|
| v2 | **Landing completa y registro abierto** en la raíz, como hace Linktree | La v1 ya tiene una landing simple de una pantalla. La v2 la amplía (beneficios, cómo funciona, ejemplos y preguntas frecuentes) y suma el registro. `/plektia`, que en la v1 tiene el contenido en el repo, pasa a la base para editarse desde el panel |
| v2 | Kick en vivo, filtros por etiqueta, los otros 3 temas | Ya previstos en los specs |
| v3 | **Sección Shop** separada de Links (pestañas Links / Shop) | Requiere un tipo de bloque nuevo; no es un link común |
| v3 | **Avatar animado** (GIF o WebP animado) | Con pausa automática por `prefers-reduced-motion` y un control para detenerlo (AAA) |
| v3 | **Íconos de atajo** a las redes del usuario, debajo de la bio | Salen de los links con proveedor detectado; podría adelantarse porque es chico |
| v3 | Variante de estilo "patchera + subte" | En reserva en el brief de marca |

## Fuera de alcance (v1)

- Multiusuario abierto (registro público). El modelo de datos ya lo soporta; solo falta abrir el registro.
- Kick, TikTok, Instagram live.
- Filtros por etiqueta en la página pública (los datos ya existen).
- Temas personalizables por usuario.
