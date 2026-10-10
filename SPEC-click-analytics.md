# Spec: `click-analytics`

> Módulo del [mapa de capacidades](CAPABILITY-MAP.md). Depende de
> [`public-page`](SPEC-public-page.md) y [`admin-panel`](SPEC-admin-panel.md), y hereda
> las convenciones de [`platform`](SPEC-platform.md). Estado: **aprobado (2026-10-10)**.

## Objetivo

Que el dueño sepa cuántas visitas tiene su página, qué links se tocan, de qué país y desde qué red llega su audiencia, **sin cookies, sin identificadores y sin guardar datos personales**. Sin banner de consentimiento y sin rastreo de terceros.

### Historias y criterios de aceptación

1. **Medición en la página.** Cada carga de la página pública suma una visita y cada toque de un link suma un clic. El link apunta directo a su destino: el aviso sale en segundo plano y la navegación no espera.
2. **Tus clics no cuentan.** Si quien visita es el dueño con sesión iniciada, no se registra nada.
3. **Panel (`/admin/estadisticas`).** Elijo el período (7, 30 o 90 días) y veo:
   - visitas, clics y porcentaje de clics (CTR) del período, comparados con el período anterior;
   - los clics por link, ordenados, con su CTR;
   - los países principales;
   - los orígenes principales: Instagram, TikTok, X, YouTube, Facebook, LinkedIn, WhatsApp, directo y otros;
   - la evolución diaria de visitas y clics.
4. **Honestidad de los números.** El panel aclara que son **eventos, no personas**: una misma persona que recarga suma otra visita. Contar personas únicas requiere identificadores y está fuera de la política de privacidad.
5. **Privacidad.** `/plektia/privacidad` explica exactamente esto: qué se cuenta, que no se guardan IPs ni identificadores y cuánto tiempo se conservan los agregados.

## Cómo se mide

| Paso | Detalle |
|---|---|
| Visita | Al cargar la página, `navigator.sendBeacon('/api/e', { t: 'view', h: handle, s: source })`. Se hace desde el cliente porque la página sale de caché (Workers Cache) y el servidor no se entera de cada carga |
| Clic | En el `click` de cada link, `sendBeacon('/api/e', { t: 'click', l: linkId, s: source })`. Si `sendBeacon` no existe, se usa `fetch(…, { keepalive: true })` |
| Origen | Se calcula en el navegador a partir de `document.referrer` y de las marcas del navegador embebido (Instagram, TikTok, Facebook y otros declaran su app en el *user agent*). Solo se envía la **categoría**, nunca el referer ni el user agent |
| País | El Worker lo lee de `request.cf.country`, que viene de Cloudflare. **La IP nunca se guarda ni se procesa fuera de Cloudflare** |
| Dueño | El endpoint ve la cookie de sesión (mismo origen) y descarta el evento si la sesión es del dueño de ese perfil |

- **Endpoint `POST /api/e`:**
  - valida con Zod: `t` en `view` o `click`, `h` como handle válido, `l` como UUID y `s` dentro del enum de orígenes;
  - rechaza cuerpos de más de 512 bytes;
  - responde siempre `204` (no revela si el link existe);
  - tiene un *rate limit* por IP con el binding de Cloudflare, en memoria efímera (30 eventos por minuto).
- **Agregación al escribir:** no se guardan eventos individuales. Cada evento incrementa contadores diarios en Postgres mediante `ingest_event(…)`, que solo acepta links **visibles** de perfiles activos.

## Modelo de datos

```sql
create table public.stats_daily (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  day         date not null,
  views       integer not null default 0,
  clicks      integer not null default 0,
  primary key (profile_id, day)
);

create table public.link_stats_daily (
  link_id     uuid not null references public.links(id) on delete cascade,
  day         date not null,
  clicks      integer not null default 0,
  primary key (link_id, day)
);

create table public.stats_breakdown_daily (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  day         date not null,
  dimension   text not null check (dimension in ('country', 'source')),
  value       text not null check (char_length(value) <= 16),
  views       integer not null default 0,
  clicks      integer not null default 0,
  primary key (profile_id, day, dimension, value)
);
```

- **Lectura:** RLS solo para el dueño (`profile_id = auth.uid()`, o a través de `links.owner_id`).
- **Escritura:** ninguna política para `anon` ni `authenticated`. Solo `ingest_event`, invocada desde `infrastructure/analytics/ingest-client.ts` con la clave de servicio. [`platform`](SPEC-platform.md) se actualiza para permitir la clave **solo** en módulos `**/ingest-client.ts` que llaman funciones `ingest_*` (regla de Semgrep).
- **Retención:** los agregados diarios se guardan 400 días; un cron mensual borra lo anterior.
- **Consultas del panel:** funciones `stats_summary(from, to)`, `stats_by_link(from, to)` y `stats_breakdown(from, to, dimension)`, `security invoker`, con índices por `(profile_id, day)`.

## Panel

- Se diseña con impeccable (modo *operate*) y la skill `dataviz`, sobre [DESIGN.md](DESIGN.md).
- Los números grandes van en Bricolage. La evolución diaria es un gráfico de barras simple en SVG, sin librerías pesadas.
- La tabla de links tiene cifras tabulares, y la lima sigue reservada al en vivo.
- **Estados:**
  - **sin datos:** "Todavía no hay visitas. Compartí tu página: [copiar link]";
  - **cargando** y **error**.
- La vista es accesible: cada gráfico tiene su tabla equivalente.

## Seguridad y privacidad: amenazas y mitigaciones

| Amenaza | Mitigación | Test |
|---|---|---|
| Inflar números con un script | *Rate limit* por IP; validación estricta; solo links visibles y perfiles activos; sin escritura directa a las tablas | Integración: 100 eventos seguidos → se registran ≤ 30; pgTAP: `anon` y `authenticated` no pueden escribir |
| Ver las estadísticas de otro | RLS por dueño | pgTAP con dos usuarios |
| Inyectar valores arbitrarios en dimensiones | Enum de orígenes; país de `request.cf` (dos letras, no del cliente); `check` de longitud | Unit + pgTAP |
| Enumerar links o perfiles con el endpoint | Siempre `204`, exista o no | Integración |
| Datos personales | Sin IP, user agent, referer completo, cookies propias ni identificadores; solo agregados diarios | E2E: el body enviado solo contiene `t`, `h`/`l` y `s`; revisión del esquema |
| CSRF o abuso desde otros sitios | El endpoint solo acepta `Content-Type` de beacon y `Origin` propio; igual no tiene efectos sensibles | Integración |
| Clave de servicio fuera de lugar | Solo en `ingest-client.ts` (regla de Semgrep) | CI |

## v2: links cortos (`/go/{slug}`)

Para compartir links fuera de la página, por ejemplo en una descripción de YouTube o un flyer, con sus clics medidos:

- **Slug:** se elige en el panel o por MCP. Es único globalmente, con las mismas reglas y palabras reservadas que los handles.
- **Redirección:** `302` a la URL **guardada y validada** del link. Nunca a un destino recibido por parámetro, así que no es una redirección abierta.
- **Medición:** cuenta en el servidor, con origen `shortlink`. Las redirecciones no pasan por la caché de la página, así que no hace falta beacon.
- **Base para monetizar:** el mismo mecanismo habilita links de afiliado, destino por país o dispositivo, links que vencen y pruebas A/B. Cada una tendrá su propio spec.

## Testing

- **Unit:** clasificación de origen (referers y user agents de navegadores embebidos reales), validación del evento y armado de los resúmenes.
- **Integración:** endpoint `/api/e` (204, *rate limit*, descarte del dueño y de links ocultos) contra Supabase local.
- **pgTAP:** RLS de lectura, ausencia de escritura directa, `ingest_event` (solo visibles y activos) y la purga por retención.
- **E2E:**
  - visitar y tocar un link incrementa los números del panel;
  - con sesión de dueño no suma;
  - el body del beacon no lleva datos de más;
  - el panel muestra los estados vacío y con datos;
  - axe AA.

## Criterios de éxito

- [ ] Visitas y clics aparecen en el panel en menos de 1 minuto.
- [ ] La página pública no envía cookies ni contacta terceros por las métricas (E2E de red).
- [ ] Ningún dato personal persiste: revisión del esquema más un test que lo verifica.
- [ ] Los clics del dueño no se cuentan.
- [ ] La política de privacidad describe exactamente lo implementado.
- [ ] Cada fila de la tabla de amenazas tiene su test, en verde en CI.

## Fuera de alcance

- Visitantes únicos, embudos y mapas de calor.
- Exportar a CSV (puede sumarse fácil más adelante).
- Links cortos y monetización (v2).
