# ADR 0003: Caché del Worker con purga por etiqueta desde el cron

- **Estado:** aceptada
- **Fecha:** 2026-10-14

## Contexto

La página pública se sirve desde la caché para que cargue rápido y no consulte Supabase en cada visita. El estado "en vivo" de YouTube y Twitch cambia cada pocos minutos: el cron de `live-status` lo actualiza y tiene que invalidar las páginas afectadas.

El plan marcaba un riesgo ([tasks/plan.md](../../tasks/plan.md)): que la purga de Workers Cache no alcanzara al handler `scheduled`, porque es otra forma de invocar al Worker. La alternativa era purgar desde `fetch` mediante un *service binding*.

Según la [documentación de Workers Cache](https://developers.cloudflare.com/workers/cache/purge/):

- La caché se activa con `"cache": { "enabled": true }` en `wrangler.jsonc` y solo guarda lo que la respuesta marca como cacheable (`Cache-Control` o `Cloudflare-CDN-Cache-Control`).
- `ctx.cache.purge({ tags })` borra las respuestas con esas etiquetas (`Cache-Tag`), pero **solo dentro del mismo *entrypoint*** que hace la purga.
- Las invocaciones del cron nunca pasan por la caché.

## Spike (tarea 6)

Hice una ruta de prueba que devolvía la hora en que se generó, con `Cloudflare-CDN-Cache-Control: public, max-age=3600` y `Cache-Tag: spike-cache`. El cron la purgaba cada 5 minutos. Resultado en `plektia.plektia.workers.dev`:

| Hora (UTC) | Evento | Resultado |
|---|---|---|
| 17:21:22 | Primer pedido | `MISS`; se genera a las 17:21:22.193 |
| 17:21:24 y 17:21:26 | Pedidos siguientes | `HIT`, misma hora |
| 17:25:26 | Corre el cron | `purge()` devuelve `success: true` |
| 17:26:38 | Pedido siguiente | `MISS`, hora nueva (17:26:38.565) |
| 17:26:38 | Otro pedido | `HIT` |

En local (`wrangler dev`) la caché del Worker no se emula: `ctx.cache` no existe y cada pedido genera una respuesta nueva. Por eso el spike tuvo que correr en producción.

## Decisión

- La página pública se cachea en la **caché del Worker**, con etiquetas por perfil.
- El cron purga esas etiquetas con `ctx.cache.purge()` desde `scheduled`, en el mismo `export default` que atiende `fetch`. **No hace falta un *service binding*.**
- La caché queda **apagada** (`"enabled": false`) hasta la fase F4 (`public-page`), que define qué rutas se cachean, por cuánto tiempo y con qué etiquetas. Mientras ninguna ruta tenga esa política, activarla no aporta nada y suma riesgo.

## Consecuencias

- `fetch` y `scheduled` tienen que seguir en el mismo *entrypoint*. Si algún día se separan en *entrypoints* con nombre, la purga tiene que hacerse desde el *entrypoint* que cacheó.
- La purga usa los límites del plan gratuito de Cloudflare. El cron purga solo las etiquetas de los perfiles que cambiaron, no todo.
- Los tests locales no pueden comprobar la caché. La política de caché se verifica con E2E contra producción después de cada deploy (`E2E_BASE_URL`).
- Las rutas del panel nunca se cachean. Además, las respuestas con `Set-Cookie` y los pedidos con `Authorization` saltean la caché siempre.

## Implementación (tarea 17, 2026-10-22)

- **Política por respuesta** (`src/infrastructure/http/cache-policy.ts`, aplicada por un middleware):

  | Rutas | Caché |
  |---|---|
  | Perfiles (`/{handle}`, 200) | 1 minuto, `stale-while-revalidate` 5 minutos, etiqueta `profile:{handle}` |
  | 404 de un handle | 1 minuto, con la misma etiqueta, así crear el perfil lo purga |
  | Landing, `/plektia`, `/legal/privacy`, sitemap y robots | 5 minutos, etiqueta `site` |
  | Login, auth, panel y contacto; redirecciones, errores, POST y respuestas con cookie | `private, no-store` |
  | Cualquier otra ruta | `private, no-store`: lo que no está en la política no se cachea |

- **Purga:** `WorkerPageCache` (`src/infrastructure/cache/purge.ts`) usa `cache.purge` de `cloudflare:workers`, sin el contexto de la petición. Una purga fallida solo deja rastro en el log, porque lo cacheado vence solo.
- **Desvío de la spec, por ahora:** los parámetros de la URL forman parte de la clave de caché, así que `/juedsay?utm_source=x` es una entrada aparte. Ignorarlos exige partir el Worker en una puerta de entrada sin caché y la app en otro *entrypoint* con `cf.cacheKey`, y mover la purga a ese *entrypoint*. Las páginas no cambian según los parámetros, así que el costo es solo alguna consulta de más.
- **El host no está en la clave:** la caché es del Worker, no del dominio. **Al sumar un dominio propio**, las URLs absolutas de la página (la canónica, `og:url`, `og:image` y el sitemap) tienen que salir de una configuración fija y no del pedido. Si no, una página cacheada desde `workers.dev` se serviría con esas URLs en el dominio nuevo. Está en el checklist de apertura (CAPABILITY-MAP).
