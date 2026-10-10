# Plan de implementación: Plektia v1

## Resumen

Construir Plektia según los 7 specs aprobados (`SPEC-*.md`) y [DESIGN.md](../DESIGN.md), en **8 fases** que terminan en entregas usables. Cada tarea es una porción vertical chica (S/M), con tests de seguridad incluidos, y deja el sistema funcionando. Las tareas detalladas, con criterios y verificación, están en [todo.md](todo.md).

## Decisiones de arquitectura (de los specs)

- Astro 7 + islas React 19 solo en el panel; Cloudflare Workers en `*.workers.dev`; Supabase (Postgres + RLS + Auth + OAuth 2.1 server); pnpm; TypeScript estricto.
- Puertos y adaptadores: `domain` → `application` → `infrastructure`. El panel, el MCP y los tests comparten los casos de uso.
- **La base es la fuente de verdad de la seguridad:** RLS en toda tabla, `check` y triggers para las reglas críticas, y la clave de servicio solo en `**/ingest-client.ts`.
- Caché de páginas con Workers Cache y purga por etiqueta desde el propio Worker.
- Cada fila de cada tabla de amenazas tiene su test; la CI bloquea el merge si algo falla.

## Grafo de dependencias

```
F1 platform ──► F2 identity ──► F3 links ──► F4 public-page ══► ENTREGA 1 (tu página online)
                                    │
                                    ├──► F5 admin-panel ══► ENTREGA 2 (editás desde la web)
                                    │        │
                                    ├──► F6 live-status ══► ENTREGA 3 (en vivo + último video)
                                    │        │
                                    │        └──► F7 click-analytics (beacon en public-page + vista en panel)
                                    │
                                    └──► F8 mcp-server (usa los casos de uso de F3, F6 y F7)
```

## Fases

| Fase | Tareas | Entrega o resultado |
|---|---|---|
| F1 · Platform | 1–6 | Repo con Astro, Supabase local, tests de los 4 niveles, CI y deploy a `workers.dev` |
| F2 · Identity | 7–9 | Login con GitHub y Google, registro cerrado y `/admin` protegido |
| F3 · Links | 10–13 | Modelo de datos con RLS, casos de uso y vista pública; seed con tus links |
| F4 · Public page | 14–17 | **Entrega 1:** `/juedsay` online, igual al prototipo, con los presupuestos de rendimiento y AAA |
| F5 · Admin panel | 18–23 | **Entrega 2:** editor con vista previa, perfil, avatar y usuarios |
| F6 · Live status | 24–26 | **Entrega 3:** en vivo de YouTube y Twitch, contenido destacado y "Comprobar ahora" |
| F7 · Analytics | 27–28 | Visitas y clics sin cookies, y la vista de estadísticas |
| F8 · MCP | 29–32 | Conectar Claude con consentimiento, permisos y revocación |
| Cierre | 33 | `/security-review`, `/webperf`, `/ship`; repo público |

El orden pone **lo más riesgoso primero dentro de cada fase**:

- **F1:** la compatibilidad de TypeScript 7 y el adaptador de Cloudflare.
- **F2:** el hook de registro cerrado.
- **F3:** las políticas RLS.
- **F6:** las playlists de YouTube sin documentar.
- **F8:** el servidor OAuth en beta.

## Paralelización posible

- Después de F3: **F5 y F6 son independientes** (comparten el contrato de `links`, ya cerrado).
- Los tests de una tarea terminada se pueden escribir en paralelo a la siguiente.
- Secuencial siempre: las migraciones de base (una por tarea, en orden) y la CI.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| TypeScript 7 incompatible con `astro check` o `typescript-eslint` | Medio | Se prueba en la tarea 1; si falla, TS 6.x y ADR |
| Servidor OAuth de Supabase en beta (cambios de API) | Alto para F8 | F8 va al final; tests de integración del flujo completo; adaptador aislado |
| Playlists `UULF`, `UUSH` y `UULV` de YouTube no documentadas | Medio | Plan B con más cuota; test de contrato semanal contra la API real |
| La purga de Workers Cache no alcanza al handler `scheduled` (otro entrypoint) | Medio | Se verifica en la tarea 6 con un *spike*; alternativa con un *service binding* |
| Límites del plan gratuito de Cloudflare o Supabase | Bajo | Presupuestos de cuota en `live-status`; métricas agregadas |
| Alcance grande para una persona | Medio | Cada fase termina en algo usable; se puede pausar después de cualquier entrega |

## Pasos manuales (los guía `wizard` en su tarea)

- Cuenta de Cloudflare y token de deploy para CI (tarea 6).
- Proyecto de Supabase en la nube y sus secretos (tarea 6).
- OAuth App de GitHub y cliente OAuth de Google (tarea 9).
- API key de YouTube y app de Twitch (tareas 25 y 26).
- Activar el servidor OAuth de Supabase (tarea 30).

## Preguntas abiertas

- Ninguna bloqueante. Las decisiones pendientes de cada spec ya están resueltas.
