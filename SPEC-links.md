# Spec: `links`

> Módulo del [mapa de capacidades](CAPABILITY-MAP.md). Depende de
> [`identity`](SPEC-identity.md) y hereda las convenciones de
> [`platform`](SPEC-platform.md). Estado: **borrador, pendiente de aprobación**.

## Objetivo

El modelo de datos y los casos de uso de secciones y links: crear, editar, ocultar, borrar, ordenar y mover. Es el núcleo que consumen `public-page` (lectura pública), `admin-panel` y `mcp-server` (escritura) y `live-status` (canales a vigilar). Todas las entradas pasan por los **mismos casos de uso**, con las mismas reglas.

### Historias y criterios de aceptación

1. **Secciones.** Como dueño, creo, renombro, oculto, reordeno y borro secciones, y elijo si su título se muestra en la página pública.
   - Al borrar una sección con links, los links pasan a **"Sin sección"** (`section_id = null`) y quedan al final, en su orden relativo.
   - "Sin sección" no es una fila: es el grupo de links con `section_id` nulo y se muestra sin título.
2. **Links.** Como dueño, creo un link con título, URL y una descripción opcional; lo edito, lo oculto o lo borro.
   - Al guardar, se detecta el proveedor a partir de la URL (YouTube, Twitch, Kick, WhatsApp, GitHub, Instagram, genérico) para que `live-status` y la UI lo usen.
3. **Orden.** Reordeno links dentro de una sección, los muevo entre secciones y reordeno secciones. El orden se guarda de forma atómica: nunca quedan posiciones duplicadas ni huecos visibles.
4. **Ocultar.** Lo oculto (link o sección) no aparece en la página pública y **no se puede leer desde afuera**. Un link visible dentro de una sección oculta tampoco se muestra.
5. **Etiquetas.** Cada link puede tener hasta 5 etiquetas. Se guardan pero todavía no se muestran: el filtro público es una entrega futura.
6. **Ediciones concurrentes.** Si el panel y el agente de IA editan el mismo link a la vez, el segundo cambio se rechaza con un conflicto claro en vez de pisar al primero.

## Reglas de validación (dominio)

Viven en `src/domain/link.ts` y `src/domain/section.ts` como schemas Zod. La base de datos repite las críticas con `check`, por si alguien escribe sin pasar por la app.

| Campo | Regla |
|---|---|
| `url` | Esquema `https:` o `mailto:` y nada más. Máximo 2048 caracteres. Sin usuario ni contraseña embebidos (`https://user:pass@…`). Host obligatorio en https. Se guarda normalizada con `new URL()` |
| `title` | 1 a 80 caracteres después de `trim`; sin caracteres de control |
| `description` | Opcional, hasta 120 caracteres |
| `tags` | Hasta 5; cada una de 1 a 24 caracteres `[a-z0-9-]`, en minúsculas y sin repetir |
| Título de sección | 1 a 40 caracteres |
| Límites por usuario | 30 secciones y 200 links (evita abuso y páginas que no cargan) |

- WhatsApp (`https://wa.me/…`) y similares entran como https comunes.
- Los dominios internacionalizados se muestran en punycode en el panel, para que no se puedan disfrazar dominios con letras parecidas (homógrafos).

### Detección de proveedor

La función pura `detectProvider(url)` devuelve `{ provider, handle }`:

| Proveedor | URLs reconocidas | `handle` |
|---|---|---|
| `youtube` | `youtube.com/@x`, `youtube.com/channel/UC…`, `youtube.com/c/x` | `@x` o `UC…` |
| `twitch` | `twitch.tv/x` | `x` |
| `kick` | `kick.com/x` | `x` (vigilado desde v2) |
| `whatsapp`, `github`, `instagram` | dominios oficiales | — |
| `generic` | cualquier otra | — |

Solo compara el **host exacto** (con o sin `www.`). `youtube.com.evil.com` es `generic`. Resolver un `@handle` al ID de canal `UC…` le toca a `live-status`, porque necesita la API.

## Modelo de datos

```sql
create table public.sections (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 40),
  show_title  boolean not null default true,
  visible     boolean not null default true,
  position    integer not null check (position >= 0),
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, position) deferrable initially deferred
);

create type public.link_provider as enum
  ('generic', 'youtube', 'twitch', 'kick', 'whatsapp', 'github', 'instagram');

create table public.links (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  section_id       uuid references public.sections(id) on delete set null,
  title            text not null check (char_length(trim(title)) between 1 and 80),
  url              text not null check (char_length(url) <= 2048 and url ~ '^(https://|mailto:)'),
  description      text check (char_length(description) <= 120),
  provider         public.link_provider not null default 'generic',
  provider_handle  text check (char_length(provider_handle) <= 100),
  tags             text[] not null default '{}' check (cardinality(tags) <= 5),
  visible          boolean not null default true,
  position         integer not null check (position >= 0),
  version          integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index links_owner_section_position on public.links (owner_id, section_id, position);
create index links_live_targets on public.links (provider, provider_handle)
  where provider in ('youtube', 'twitch', 'kick');
```

- **Posición única por grupo:** un índice único parcial cubre los links con sección, `(section_id, position)`, y otro los "Sin sección", `(owner_id, position) where section_id is null`. Los dos son *deferrable*, para poder reordenar dentro de una transacción.
- **Sección del mismo dueño:** un trigger impide asignar un link a una sección de otro usuario. RLS no alcanza para eso, porque la fila nueva es del usuario pero la sección referenciada no.
- **Al borrar una sección:** `on delete set null` más un trigger `after delete` que recoloca esos links al final de "Sin sección".
- **Límites:** un trigger `before insert` cuenta y rechaza el link 201 y la sección 31.
- **`version`:** cada `update` exige la versión leída y la incrementa; si no coincide, el caso de uso devuelve `conflict`.

### Políticas RLS

| Tabla | Operación | Quién | Regla |
|---|---|---|---|
| `sections` | `select` | `anon`, `authenticated` | `visible` **o** `owner_id = auth.uid()` |
| `sections` | `insert` / `update` / `delete` | `authenticated` | `owner_id = auth.uid()` (con `with check` en insert y update) |
| `links` | `select` | `anon`, `authenticated` | (`visible` y sección visible o nula) **o** `owner_id = auth.uid()` |
| `links` | `insert` / `update` / `delete` | `authenticated` | `owner_id = auth.uid()` (con `with check`) |

- Las columnas `owner_id`, `id` y `created_at` no se pueden actualizar: se usan privilegios por columna.
- **Lectura pública:** la vista `public.public_page_v` (`security_invoker = true`) arma, a partir de un `handle`, el perfil con sus secciones y links visibles en orden, en una sola consulta.

### Operaciones atómicas (RPC)

Funciones `security invoker` (las protege RLS) que ejecutan cada cambio de orden en una sola transacción:

- `reorder_sections(ids uuid[], expected_versions int[])`
- `move_links(target_section uuid | null, ids uuid[], expected_versions int[])`: reordena y mueve. La lista recibida es el **orden final completo** del grupo destino.

Las dos validan que todos los IDs sean del usuario y que la lista coincida exactamente con los elementos del grupo. Si no, rechazan todo.

## Código (puertos y casos de uso)

| Capa | Archivo | Responsabilidad |
|---|---|---|
| domain | `link.ts`, `section.ts`, `provider.ts`, `safe-url.ts` | Schemas Zod, `detectProvider`, `parseSafeUrl` |
| application/ports | `link-repository.ts` | `LinkReader` (lectura propia y pública) y `LinkWriter` (escritura), separados (ISP) |
| application/links | `create-link.ts`, `update-link.ts`, `set-link-visibility.ts`, `delete-link.ts`, `move-links.ts` | Un caso de uso por archivo |
| application/sections | `create-section.ts`, `update-section.ts`, `delete-section.ts`, `reorder-sections.ts` | Ídem |
| application/public | `get-public-page.ts` | Modelo de lectura para `public-page` |
| infrastructure/supabase | `supabase-link-repository.ts` | Implementa los puertos con el cliente de la sesión, nunca con la `service_role` |

Errores tipados como valores: `invalid_input`, `not_found`, `conflict`, `limit_reached`, `forbidden`. Los mensajes en español para la UI y el MCP salen de un único mapa.

## Seguridad: amenazas y mitigaciones

| Amenaza | Mitigación | Test |
|---|---|---|
| XSS con `javascript:` o `data:` en la URL | Allowlist `https:`/`mailto:` en Zod **y** `check` en la base | Unit: tabla de URLs maliciosas (mayúsculas, espacios, entidades, tabs, `java\tscript:`); pgTAP: el `insert` directo falla |
| Phishing con credenciales embebidas o dominios parecidos | Rechazar `user:pass@`; mostrar punycode en el panel | Unit |
| Leer links o secciones ocultos de otro | RLS de `select` | pgTAP: `anon` y otro usuario no ven lo oculto; el dueño sí |
| Escribir en datos ajenos | RLS + `with check` + trigger de sección del mismo dueño | pgTAP: `insert`/`update`/`delete` cruzados fallan; mover un link a una sección ajena falla |
| Robar un link cambiando su `owner_id` | Privilegios por columna | pgTAP |
| Reordenar con IDs ajenos o listas parciales | Validación en la RPC: misma cantidad y mismos dueños | pgTAP |
| Spoofing de proveedor (`youtube.com.evil.com`) | `detectProvider` compara el host exacto | Unit |
| Abuso por cantidad | Límites en Zod y en el trigger | pgTAP: el link 201 falla |
| Pisar cambios concurrentes (panel y MCP) | `version` optimista | Integración: dos updates con la misma versión → el segundo da `conflict` |
| Contenido que rompe el layout (Unicode raro, saltos) | `trim`, sin caracteres de control, longitudes máximas | Unit |

## Testing

- **Unit (≥ 90 %):** `parseSafeUrl` (al menos 30 casos, incluidos maliciosos), `detectProvider`, schemas, y los casos de uso con puertos falsos (validación, `conflict`, `limit_reached`).
- **pgTAP:** cada política de las dos tablas con `anon`, dueño, otro usuario y `service_role`; los triggers (dueño de la sección, límites, recolocar al borrar); las RPC de orden (atomicidad e IDs ajenos); los `check` de URL.
- **Integración:** `SupabaseLinkRepository` contra Supabase local, con concurrencia por `version` y la vista pública.
- **E2E:** se cubre en `admin-panel` y en `public-page`.

## Fuera de alcance

- Mostrar etiquetas y filtrar por ellas en la página pública.
- Links programados por fecha.
- Previsualización (Open Graph) de cualquier link: solo se muestra el video de YouTube, que resuelve `live-status`.
- Kick en vivo (el proveedor se detecta y se guarda, pero no se vigila hasta v2).
- Historial y papelera de links borrados.

## Criterios de éxito

- [ ] Todos los casos de uso funcionan contra Supabase local y tienen tests unitarios con cobertura ≥ 90 %.
- [ ] Cada fila de la tabla de amenazas tiene su test, en verde en CI.
- [ ] `get-public-page` devuelve un perfil completo, con lo visible en orden, en **una** consulta.
- [ ] Reordenar 50 links es una sola transacción y nunca deja posiciones duplicadas (test con reorden aleatorio repetido).
- [ ] Borrar una sección con links los deja en "Sin sección", al final y en su orden relativo.
- [ ] Los tipos de TypeScript salen de `pnpm db:types` y el código compila sin `any`.

## Preguntas abiertas

1. ¿Los límites (30 secciones, 200 links, 5 etiquetas) te parecen bien para la v1?
