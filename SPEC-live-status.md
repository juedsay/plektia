# Spec: `live-status`

> Módulo del [mapa de capacidades](CAPABILITY-MAP.md). Depende de
> [`links`](SPEC-links.md) y hereda las convenciones de [`platform`](SPEC-platform.md).
> Estado: **aprobado (2026-10-10)**.

## Objetivo

Que la página "esté viva" sin que el dueño toque nada:

- muestra **si está en vivo** en YouTube o Twitch, en los canales donde el dueño indicó que transmite;
- muestra **el contenido de YouTube que eligió destacar**: el último video, el último Short, el último stream terminado, o uno fijado a mano;
- consume lo mínimo posible de las APIs, porque solo vigila lo que el usuario pidió vigilar.

### Historias y criterios de aceptación

1. **Transmito en este canal.** En cada link de YouTube, Twitch o Kick hay un interruptor "Transmito en este canal", **apagado por defecto**. Solo esos canales se revisan.
2. **En vivo.** Si un canal vigilado está transmitiendo, la página lo muestra a más tardar **10 minutos** después de empezar y deja de mostrarlo a más tardar 10 minutos después de terminar.
3. **Comprobar ahora.** Desde el panel ("Comprobar ahora") o desde el MCP, el dueño fuerza una revisión inmediata de sus canales vigilados. El resultado se ve en la página en segundos.
   - Límite: una vez por minuto por usuario.
4. **Contenido destacado de YouTube.** En cada link de YouTube elijo qué mostrar en la sub-fila plegable:
   - **Último video:** contenido largo, sin Shorts ni streams.
   - **Último Short.**
   - **Último stream terminado.**
   - **Fijado:** pego la URL de un video o Short propio o ajeno que quiera recomendar.
   - **Nada:** el link se muestra solo.

   El predeterminado al crear el link es "Último video". Los Shorts se muestran con miniatura vertical (9:16).
5. **Datos viejos.** Si una revisión falla o lleva más de 25 minutos sin hacerse, la página **no** muestra "En vivo", para no anunciar un directo que quizás terminó. El contenido destacado sigue visible con su último dato bueno.

## Cómo se obtiene cada dato

| Dato | Fuente | Costo | Frecuencia |
|---|---|---|---|
| ID de canal de YouTube (`@handle` → `UC…`) | Data API `channels.list?forHandle=` | 1 unidad, una sola vez por canal | Al crear o editar el link |
| En vivo en YouTube | Playlist de directos del canal (`UULV…`) vía `playlistItems.list` + `videos.list` (`liveStreamingDetails`) en lote | ~2 unidades por revisión (hasta 50 canales por llamada) | Cada 10 min, solo canales vigilados |
| Último video / Short / stream terminado | Playlists derivadas del ID de canal: `UULF…` (largos), `UUSH…` (Shorts), `UULV…` (directos), vía `playlistItems.list` | 1 unidad por playlist | Cada 60 min, solo el tipo elegido |
| Video fijado | `videos.list` | 1 unidad | Al fijarlo y luego cada 24 h |
| En vivo en Twitch | Helix `GET /streams?user_login=` (hasta 100 por llamada) con token de app (*client credentials*) | Sin cuota en unidades; límite de 800 por minuto | Cada 10 min, solo canales vigilados |
| Kick | API oficial de Kick | — | **v2** (el proveedor ya se detecta y se guarda) |

- **Presupuesto de YouTube** (10.000 unidades diarias gratis): con 10 canales vigilados y 10 links destacados se usan menos de 600 por día.
- **Riesgo conocido:** las playlists `UULF`, `UUSH` y `UULV` son una convención de YouTube **no documentada oficialmente**. Si dejan de existir, el adaptador cae a un plan B: `search`/`videos.list` con la duración (Short ≤ 180 s) y `liveStreamingDetails`. Ese plan B cuesta más cuota, así que un test de contrato contra la API real (manual o semanal) avisa si la convención cambia.
- **Más adelante (v2):** recibir avisos por push (Twitch EventSub, YouTube WebSub) para que el en vivo aparezca en segundos sin revisiones periódicas.

## Arquitectura (puertos y adaptadores)

```
scheduled (cron */10)                   Action "Comprobar ahora" / tool MCP
        │                                            │
        └──────────────► refreshChannels(scope) ◄────┘
                               │
              ┌────────────────┼─────────────────┐
     LiveStatusProvider  LiveStatusProvider  FeaturedContentProvider
        (youtube)           (twitch)            (youtube)
                               │
                ChannelStatusRepository (Supabase)
                               │
        purgar Cache-Tag profile:{handle} de los perfiles afectados
```

- `LiveStatusProvider` es una interfaz única: `checkLive(channels): Promise<Map<channelId, LiveState>>`. Agregar Kick es una carpeta nueva que la implementa, sin tocar el resto (*abierto/cerrado*), y todos los proveedores pasan la **misma suite de contrato** (*sustitución de Liskov*).
- `refreshChannels` solo calcula diferencias y guarda lo que cambió. Si algo cambió, purga la caché de las páginas que usan ese canal.
- **Los canales se comparten:** si dos usuarios tienen el mismo canal, se revisa una sola vez.
- Dos cron: `*/10 * * * *` (en vivo) y `0 * * * *` (contenido destacado). Las dos tareas tienen un *lock* para no solaparse.

## Modelo de datos

```sql
-- Configuración por link: la escribe el dueño (RLS por owner).
create table public.link_media_settings (
  link_id          uuid primary key references public.links(id) on delete cascade,
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  watch_live       boolean not null default false,
  featured_mode    text not null default 'latest_video'
                   check (featured_mode in ('none','latest_video','latest_short','latest_stream','pinned')),
  pinned_video_id  text check (pinned_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  updated_at       timestamptz not null default now(),
  check (featured_mode <> 'pinned' or pinned_video_id is not null)
);
-- Un trigger fija `owner_id` desde el link y rechaza cada opción donde no
-- aplica (vigilar: canal de YouTube, Twitch o Kick; destacar: canal de
-- YouTube). Si el link cambia de proveedor o deja de ser un canal, la fila se
-- borra. Sin fila, rige lo predeterminado.

-- Canales únicos por proveedor: los escribe solo el proceso de refresco.
create table public.provider_channels (
  id             uuid primary key default gen_random_uuid(),
  provider       public.link_provider not null,
  handle         text not null,
  external_id    text,
  resolved_at    timestamptz,
  last_error     text,
  unique (provider, handle)
);

create table public.channel_status (
  channel_id        uuid primary key references public.provider_channels(id) on delete cascade,
  is_live           boolean not null default false,
  live_title        text,
  live_started_at   timestamptz,
  live_url          text,
  checked_at        timestamptz,
  changed_at        timestamptz
);

create table public.featured_content (
  link_id        uuid primary key references public.links(id) on delete cascade,
  video_id       text not null,
  kind           text not null check (kind in ('video','short','stream')),
  title          text not null,
  published_at   timestamptz not null,
  duration_s     integer,
  fetched_at     timestamptz not null
);
```

- **Lectura:** `public_page_v` (de `links`) suma `is_live`, `live_*` y `featured_*`. Solo devuelve `is_live = true` si `checked_at > now() - interval '25 minutes'`, así la regla de datos viejos vive en la base.
- **Escritura de `provider_channels`, `channel_status` y `featured_content`:** sin políticas de escritura para `anon` ni `authenticated`. Escribe solo el proceso de refresco, que corre en el handler `scheduled` y en la Action de "Comprobar ahora" con la clave de servicio. Solo puede hacerlo a través de `ingest-client.ts`, que invoca funciones `ingest_*` acotadas y nunca accede libremente a las tablas (regla de [`platform`](SPEC-platform.md)).
- "Comprobar ahora" pasa primero por un caso de uso con la sesión del dueño, que valida el *rate limit*, y recién después invoca el refresco **solo de sus canales**.

## Seguridad: amenazas y mitigaciones

| Amenaza | Mitigación | Test |
|---|---|---|
| SSRF con un handle armado (`../`, `@`, URL completa) | Handles validados con regex estricta por proveedor; `encodeURIComponent`; `safeFetch` con allowlist de hosts (`www.googleapis.com`, `api.twitch.tv`, `id.twitch.tv`) y sin seguir redirecciones a otros hosts | Unit: handles maliciosos; integración: `safeFetch` rechaza hosts fuera de la lista |
| Respuestas enormes o lentas de una API | Timeout de 5 s, límite de 1 MB por respuesta, *circuit breaker* por proveedor | Integración con MSW (lentas, gigantes, 500, 429) |
| Agotar la cuota (ataque o bug) | "Comprobar ahora" limitado a 1 por minuto por usuario; refresco con presupuesto diario y corte al 80 %; *backoff* ante 403 o 429 | Unit del presupuesto; integración de *backoff* |
| Filtración de claves (YouTube API key, Twitch client secret) | Secretos del Worker; la API key restringida en Google Cloud solo a YouTube Data API v3; nunca se envían al cliente | Chequeo en CI: `grep` del bundle |
| Escritura del estado por un usuario (falsificar "en vivo") | Sin políticas de escritura; solo funciones `ingest_*` con la clave de servicio | pgTAP: `authenticated` no puede escribir |
| Clave de servicio usada fuera de su lugar | Solo `infrastructure/live-status/ingest-client.ts` la importa; regla de Semgrep | CI |
| Video fijado malicioso | Solo ID de 11 caracteres validado; la miniatura sale del dominio fijo `i.ytimg.com` | Unit |
| Mostrar en vivo un stream que terminó | Regla de 25 minutos en la vista | pgTAP |

## Testing

- **Unit:** cálculo de diferencias y de perfiles a purgar, regla de datos viejos, derivación de playlists (`UC…` → `UULF…`, `UUSH…`, `UULV…`), parseo y normalización de respuestas de cada API, presupuesto de cuota y *rate limit*.
- **Contrato:** la misma suite para cada `LiveStatusProvider` (en vivo, offline, canal inexistente, error del proveedor) con respuestas grabadas.
- **Integración:** adaptadores contra MSW con respuestas reales grabadas y casos patológicos; `ingest_*` contra Supabase local; purga de caché.
- **pgTAP:** políticas de `link_media_settings` (owner), tablas de solo ingesta y la vista con la regla de 25 minutos.
- **E2E:** con el proveedor simulado en "en vivo", la página muestra el badge; "Comprobar ahora" actualiza la página en segundos; cambiar el contenido destacado a "Último Short" muestra la miniatura vertical.
- **Contrato con la API real** (manual o semanal, fuera del CI de PR): verifica que las playlists `UULF`, `UUSH` y `UULV` sigan funcionando.

## Fuera de alcance

- Kick (v2), notificaciones push (v2) y VODs o clips de Twitch.
- Estadísticas del stream (espectadores) y chat embebido.
- Contenido destacado de otras plataformas (Instagram, TikTok).

## Criterios de éxito

- [ ] Con `watch_live` activo, el en vivo aparece en ≤ 10 min (cron) o en segundos (Comprobar ahora), y desaparece en ≤ 10 min al terminar.
- [ ] Un canal sin `watch_live` no genera ninguna llamada a las APIs (verificado con contadores en tests).
- [ ] Las cuatro opciones de contenido destacado funcionan, y el Short se ve en vertical.
- [ ] El consumo diario de YouTube queda por debajo de 1.000 unidades con 10 canales vigilados.
- [ ] Cada fila de la tabla de amenazas tiene su test, en verde en CI.

## Preguntas abiertas

1. ~~Frecuencia~~ Aprobado: 10 minutos.
2. ~~Credenciales~~ Hay cuenta de desarrollador en Twitch; la app de Twitch y la API key de YouTube se crean con `wizard` al implementar.
