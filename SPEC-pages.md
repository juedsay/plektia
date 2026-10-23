# Spec: `pages`

Tarea 17c. Decisión del 2026-10-22: **una cuenta, varias páginas** (como Linktree), en lugar de varias cuentas con emails distintos (como Instagram).

## Objetivo

Que una misma persona tenga varias páginas públicas (por ejemplo, una personal y otra profesional), cada una con su `handle`, su nombre visible, su bio y sus links, sin crear cuentas duplicadas. Se hace **antes del panel (F5)**, para no tener que rehacerlo.

### Historias y criterios de aceptación

1. **Mi página de siempre.** Al migrar, mi página actual (`/juedsay`) pasa a ser mi primera página, sin ningún cambio visible: el mismo handle, los mismos links y la misma URL.
2. **Otra página.** Desde mi cuenta creo una segunda página con otro handle libre. Cada página muestra solo sus secciones y sus links.
3. **Límite.** Una cuenta tiene **hasta 3 páginas**. Al intentar crear la cuarta, recibo un aviso claro y no se crea nada.
4. **Al entrar.** El panel abre **la última página que usé**; la primera vez, la primera que se creó.
5. **Siempre al menos una.** No puedo borrar mi única página.
6. **Invitación.** Al aceptar una invitación se crea mi cuenta y mi primera página con el handle invitado, igual que hoy.
7. **Privacidad entre cuentas.** Nadie ve ni edita las páginas, secciones o links de otra cuenta, salvo lo público de una página activa.

## Diseño

### Modelo de datos

- **`public.pages`** (nueva):
  - `id`;
  - `owner_id` → `profiles`, con borrado en cascada;
  - `handle` (dominio `public.handle`, único);
  - `display_name`, `bio`, `avatar_path`, `theme` y `show_handle`;
  - `created_at` y `updated_at`.
- **`public.profiles`** queda para la persona: `id`, `role`, `disabled`, `last_page_id` (la última página usada; `null` si no hay) y las fechas. Las columnas de presentación (`handle`, `display_name`, `bio`, `avatar_path`, `theme` y `show_handle`) pasan a `pages`.
- **`sections` y `links`** suman `page_id` → `pages`, con borrado en cascada. Se mantiene `owner_id`, porque la RLS lo usa directo sin consultas extra, y un trigger exige que coincida con el dueño de la página.
- **Orden y límites por página:**
  - la posición es única por página (`sections`) y por página y sección (`links`);
  - los límites de 30 secciones y 200 links pasan a contarse **por página**;
  - el límite de **3 páginas por cuenta** lo controla un trigger con un *advisory lock* por dueño, igual que los demás límites.
- **`public_page_v`** se arma desde `pages`, une `profiles` para descartar las cuentas dadas de baja y conserva las mismas columnas.

### Migración (sin cambios visibles)

1. Crear `pages` copiando cada perfil con **el mismo `id`** (`pages.id = profiles.id`). Así `page_id` se completa con el `owner_id` que ya tienen secciones y links.
2. Agregar `page_id` a `sections` y `links`, completarlo y recién después marcarlo `not null`.
3. Rehacer las restricciones de posición y los límites por página, y la vista pública.
4. Sacar las columnas de presentación de `profiles`.
5. Actualizar el trigger de alta: crea el perfil **y** su primera página con el handle invitado.
6. Correr el control de handles reservados (`assert_no_reserved_handles_in_use`) también sobre `pages`.

### RLS

| Tabla | Operación | Regla |
|---|---|---|
| `pages` | `select` | Cualquiera, si la cuenta dueña está activa (la página pública); el dueño ve las suyas siempre |
| `pages` | `insert` | `owner_id = auth.uid()`, cuenta activa y sin `client_id` (MCP). El límite de 3 lo aplica el trigger |
| `pages` | `update` | Solo el dueño, con la cuenta activa y sin `client_id`. Por columna: `display_name`, `bio`, `theme` y `show_handle`. El `handle` y el dueño no se cambian |
| `pages` | `delete` | Solo el dueño, con la cuenta activa y sin `client_id`; un trigger impide borrar la última página |
| `profiles` | `update` | Solo `last_page_id` (además de lo que ya permitía), y solo con una página propia |

### Operaciones atómicas (RPC)

- `reorder_sections(page_id, ids, versions)`: agrega la página.
- `move_links(page_id, target_section, ids, versions)`: los links sin sección también son de una página.

### Código

| Capa | Archivo | Cambio |
|---|---|---|
| domain | `page.ts` | Límite (`PAGE_LIMIT = 3`) y validación del alta de una página |
| application | `pages/create-page.ts`, `pages/list-pages.ts` | Casos de uso; el selector y el alta en la UI son de la tarea 18 |
| application/ports | `page-repository.ts` | `PageReader`, `PageWriter` |
| infrastructure | `supabase-page-repository.ts`; `supabase-link-repository.ts` | El repositorio de links pasa a trabajar sobre una página (`pageId`) |

## Seguridad: amenazas y mitigaciones

| Amenaza | Mitigación | Prueba |
|---|---|---|
| Acaparar handles creando páginas | Límite de 3 por cuenta en la base (trigger y lock) | pgTAP: la cuarta página falla, también con altas concurrentes |
| Meter secciones o links en la página de otro | Trigger: el `owner_id` tiene que ser el dueño de la página; RLS por `owner_id` | pgTAP: con el id de una página ajena, falla |
| Quedarse sin página (estado inválido) | Trigger que impide borrar la última | pgTAP |
| Apuntar `last_page_id` a una página ajena | Check en el `update`: la página tiene que ser propia | pgTAP |
| Una sesión de una cuenta dada de baja (el JWT dura hasta una hora) sigue editando | Las políticas de `insert`, `update` y `delete` exigen la cuenta activa | pgTAP |
| Un handle reservado usado por una página | El dominio `public.handle` y el control de handles en uso | pgTAP |

## Testing

- **pgTAP:**
  - límite de 3 páginas, incluso con altas concurrentes;
  - RLS de `pages` (anónimo, dueño, otra cuenta y cuenta dada de baja);
  - el trigger de dueño en `sections` y `links`;
  - no se puede borrar la última página;
  - `last_page_id` solo propio;
  - la migración conserva los datos: misma página, mismos links y mismo orden.
- **Integración:** repositorio de páginas, y el de links sobre dos páginas de la misma cuenta, cada una con sus links.
- **Unit:** casos de uso con repositorios falsos.
- **E2E:** la página pública sigue igual (`/juedsay` con sus links) y una segunda página del seed se ve en su propio `/{handle}`.

## Fuera de alcance

- El selector de página y el alta de páginas en la UI: tarea 18 (panel).
- Cambiar el handle de una página.
- Varias personas administrando una misma página (managers): hoja de ruta v2.

## Criterios de éxito

- [ ] Tu página en producción queda igual después de la migración.
- [ ] Una cuenta del seed tiene dos páginas, cada una con sus links, en su propio `/{handle}`.
- [ ] La cuarta página se rechaza, y nadie toca páginas ajenas (pgTAP).
