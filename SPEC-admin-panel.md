# Spec: `admin-panel`

> Módulo del [mapa de capacidades](CAPABILITY-MAP.md). Depende de
> [`links`](SPEC-links.md), [`identity`](SPEC-identity.md) y `brand-system`
> ([DESIGN.md](DESIGN.md)). Hereda las convenciones de [`platform`](SPEC-platform.md).
> Estado: **aprobado (2026-10-10)**.

## Objetivo

El panel privado (`/admin`) donde el dueño arma y mantiene su página: secciones y links con vista previa en vivo, perfil, usuarios habilitados (solo el owner), estadísticas y conexiones de IA. Todo cambio se guarda y publica al instante, con la posibilidad de deshacerlo.

**Usuarios:** el owner (`juedsay`) y, más adelante, los usuarios habilitados. Lo usan desde la computadora o el celular.

### Historias y criterios de aceptación

1. **Editor (`/admin`).**
   - **Escritorio:** a la izquierda la lista de secciones y links; a la derecha la vista previa real. **Celular:** pestañas "Editar" y "Vista previa".
   - **Agregar links:** pego una URL, se detecta el proveedor y se propone un título (para proveedores conocidos, a partir del handle; ver Seguridad).
   - **Editar:** cada link se edita en el lugar. La fila se expande, sin abrir un modal: título, URL, descripción, etiquetas y visible/oculto.
   - **Secciones:** crear, renombrar, ocultar, mostrar u ocultar el título, y borrar (sus links pasan a "Sin sección").
   - **Ordenar:** arrastro links y secciones, y muevo links entre secciones. Se puede hacer todo **con teclado**, y el lector de pantalla anuncia cada movimiento.
2. **Guardado instantáneo.** Cada cambio se aplica al soltar o al salir del campo. Aparece "Guardado" y, durante 6 segundos, "Deshacer".
   - **Borrar** se confirma recién pasados esos 6 segundos. Si cierro la pestaña antes, el borrado igual se envía.
   - Si el MCP cambió el mismo elemento, aparece un aviso de conflicto con la opción de recargar ese elemento.
3. **Perfil (`/admin/perfil`).**
   - Nombre visible, bio y tema (en la v1 solo "Técnico"; los demás figuran como "Próximamente").
   - **Avatar:** subo una imagen, la recorto en un cuadrado y se guarda optimizada. Por defecto se usa la de GitHub o Google.
4. **Usuarios habilitados (`/admin/usuarios`, solo owner).**
   - **Ver:** los correos invitados y los usuarios activos.
   - **Invitar:** un correo con su `handle`. Se valida que el handle no esté reservado ni tomado.
   - **Quitar acceso:** su página deja de estar publicada y ya no puede editar nada, aunque tenga una sesión abierta.
   - Reemplaza al comando `pnpm user:allow`, que queda solo como alternativa local.
5. **Estadísticas (`/admin/estadisticas`)** y **Conexiones de IA (`/admin/conexiones`):** el panel les da la ruta, la navegación y el layout. El contenido lo definen [`click-analytics`](CAPABILITY-MAP.md) y [`mcp-server`](CAPABILITY-MAP.md) en sus specs.

## Diseño y arquitectura

- **Diseño:** se arma con impeccable en modo *operate* sobre [DESIGN.md](DESIGN.md), con la misma marca y tokens que la página pública. El panel exige WCAG 2.2 **AA** (la página pública, AAA).
- **Render:** páginas Astro on-demand con `Cache-Control: private, no-store`. Hay **una sola isla React**, el editor, con `@dnd-kit` para ordenar con mouse, toque y teclado.
- **Escritura:** Astro Actions que llaman a los casos de uso de `links` con la sesión del usuario. No hay API paralela: las Actions, el MCP y los tests pasan por las mismas funciones.
- **Vista previa:** un `<iframe>` a `/admin/vista-previa`, que renderiza los mismos componentes de `public-page` con los datos del dueño.
  - Es una ruta autenticada del mismo origen, la única con `frame-ancestors 'self'`.
  - Se recarga sin parpadeo 300 ms después de cada cambio guardado.
- **Idempotencia** (pedidos repetidos por doble clic, doble Enter o reintentos de red):
  - **Altas:** el panel genera el `id` (UUID) de lo que crea (link, sección, página) y lo reusa en cada reintento del mismo alta. Si llega dos veces, la segunda devuelve lo ya creado (también si chocó con el límite o el handle que esa misma alta completó). Un `id` ajeno es `conflict`, sin revelar nada.
  - **Bajas:** borrar algo que ya no existe es éxito (el resultado buscado ya se cumple); una `version` vieja sigue siendo `conflict`.
  - **Cambios con `version`** (mover, guardar una sección, deshacer): van en fila en el cliente, y cada uno lee la versión que dejó el anterior. Dos clics al mismo destino dejan un solo cambio.
  - **Formularios:** un segundo envío mientras el primero sigue en camino no sale.
- **Deshacer:** cada acción guarda en el cliente su inversa (por ejemplo, restaurar los valores previos o el orden anterior) y la aplica como un cambio nuevo, respetando `version`. El borrado diferido usa `fetch(…, { keepalive: true })` en `pagehide`.

### Avatar

1. En el navegador: se acepta JPEG, PNG o WebP de hasta 5 MB. Se recorta en cuadrado, se lleva a 512 × 512 y se re-codifica a WebP (o a **JPEG** donde el navegador no sabe generar WebP, como Safari; decisión del 2026-10-28), lo que además **elimina los metadatos EXIF**, como la ubicación.
2. En el servidor, la Action valida antes de guardar, con los bytes y no con el nombre o el tipo que manda el navegador: la estructura completa del WebP (chunks RIFF que cubren el archivo justo) o del JPEG (todos los segmentos, también entre barridos, terminando justo en el EOI), dimensiones exactas, peso ≤ 200 KB, sin animación y **sin EXIF, XMP, IPTC ni comentarios**. Nada después de la imagen (*polyglots*).
3. **Límite del pedido** (todas las Actions y formularios): un middleware corta antes de leer el cuerpo lo que declara más de 64 KB (256 KB para subir el avatar) con 413, y lo que no declara su largo con 411.
3. Se guarda en Supabase Storage, bucket `avatars`, en la ruta `{user_id}/{uuid}.webp`, y se actualiza `profiles.avatar_path`. El archivo anterior se borra.
4. **Políticas de Storage:** lectura pública; escritura y borrado solo en la carpeta `{auth.uid()}`, con nombres `{uuid}.webp` y sin subcarpetas. Sin `update`: un avatar nuevo es otro archivo. El bucket además limita a WebP de hasta 200 KB, y `pages.avatar_path` solo puede apuntar a la carpeta del dueño de la página (check).
5. **Se sirve desde el propio sitio** (decisión del 2026-10-28): `/avatars/{owner_id}/{uuid}.webp|jpg`. El Worker lo trae del bucket público, **lo vuelve a validar** (si algo raro quedara en el bucket, o no coincide con su extensión, responde 404) y lo devuelve con el tipo según la extensión, `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` y caché de un año (`immutable`, porque la ruta cambia con cada avatar). Así la página no pide nada a otro dominio y la CSP de la página no se abre a Supabase. `avatars` pasa a ser un handle reservado.

### Usuarios habilitados sin `service_role`

Las operaciones de owner son funciones Postgres `security definer` que primero verifican `role = 'owner'`:

- `admin_invite(email, handle)`: inserta en `private.allowed_emails` (valida el handle con las mismas reglas que `identity`).
- `admin_revoke(email)`: borra la invitación y marca `profiles.disabled = true`.
- `admin_list_users()`: devuelve invitaciones y usuarios activos (email, handle, alta, último acceso), solo para el owner.

Un usuario deshabilitado no aparece en la vista pública y las políticas RLS de `links` y `sections` rechazan sus escrituras (`not disabled`). Su token sigue siendo válido hasta que vence (1 h), pero no le sirve para nada.

Cada operación de owner queda registrada en `private.audit_log`: quién, qué, a quién y cuándo.

## Seguridad: amenazas y mitigaciones

| Amenaza | Mitigación | Test |
|---|---|---|
| Acceso sin sesión | Middleware de `identity` en `/admin/*` | E2E: redirige a `/login` |
| Un usuario que no es owner entra a `/admin/usuarios` o llama a sus funciones | Chequeo de rol en el servidor **y** dentro de cada función `security definer` | E2E: 404 para un `member`; pgTAP: `admin_invite` como `member` falla |
| CSRF en Actions | `checkOrigin` + `SameSite=Lax` + solo POST (de `identity`) | E2E: POST desde otro origen → 403 |
| SSRF al "proponer título" desde una URL | **No se hace fetch del lado del servidor** a URLs arbitrarias en la v1; el título sale del proveedor detectado o lo escribe el usuario | Revisión + test de que la Action no hace red con URLs genéricas |
| Avatar malicioso (SVG con scripts, *polyglots*, archivos gigantes) | Solo WebP re-codificado; validación de *magic bytes*, tamaño y dimensiones en el servidor; `Content-Type` fijo al servir | Integración: subir SVG, PNG renombrado, 10 MB y 4000 × 4000 → todos rechazados |
| Escribir en la carpeta de avatares de otro | Políticas de Storage por `auth.uid()` | Integración con dos usuarios |
| Clickjacking del panel | `frame-ancestors 'none'` en todo `/admin` salvo la vista previa (`'self'`) | E2E de cabeceras |
| Abuso de escritura o scripts | Rate limit de Actions: 120 por minuto por usuario | Integración |
| Usuario quitado que sigue editando | `disabled` validado por RLS | pgTAP |
| Owner que se quita a sí mismo y pierde el acceso | `admin_revoke` rechaza revocar al último owner | pgTAP |
| XSS en el panel con contenido de usuario | Mismo escape que la página pública; sin `dangerouslySetInnerHTML` (regla de Semgrep) | E2E con contenido malicioso |

## Accesibilidad (AA) e interacción

- Arrastrar y soltar tiene una alternativa completa por teclado (`@dnd-kit` con sensor de teclado) y anuncios en vivo ("Twitch movido a la posición 2 de Redes").
- Después de cada acción, el foco queda en un lugar predecible: tras borrar, pasa al elemento siguiente.
- Los errores de validación se muestran junto al campo y se anuncian, con el mensaje del mapa de errores de `links`.
- Objetivos táctiles de 44 px y uso cómodo en el celular.

## Código

| Capa | Archivo | Responsabilidad |
|---|---|---|
| pages/admin | `index.astro`, `perfil.astro`, `usuarios.astro`, `vista-previa.astro`, `estadisticas.astro`, `conexiones.astro` | Rutas finas |
| actions | `links.ts`, `sections.ts`, `profile.ts`, `users.ts` | Astro Actions → casos de uso |
| ui/islands | `Editor.tsx` (+ subcomponentes) | Única isla React: lista, edición en el lugar, arrastre, deshacer |
| application/profile | `update-profile.ts`, `set-avatar.ts` | Casos de uso de perfil |
| application/admin | `invite-user.ts`, `revoke-user.ts`, `list-users.ts` | Casos de uso de owner |
| infrastructure/supabase | `supabase-profile-repository.ts`, `supabase-avatar-storage.ts`, `supabase-admin-repository.ts` | Adaptadores |

## Testing

- **Unit:** las inversas de deshacer (cada acción y su opuesta dejan el mismo estado), la lógica de reordenar del editor, la validación del avatar y los casos de uso de admin con puertos falsos.
- **Componentes:** la isla `Editor` con Testing Library: edición en el lugar, teclado para ordenar, anuncios y conflicto por `version`.
- **pgTAP:** las funciones de owner (rol, último owner, handle reservado), `disabled` en RLS, auditoría y las políticas de Storage.
- **E2E (Playwright):**
  - crear, editar, ocultar, ordenar con mouse **y** con teclado, y borrar con deshacer;
  - el cambio aparece en la vista previa y en la página pública en menos de 5 s;
  - subir avatar;
  - invitar y revocar a un usuario;
  - axe AA y cabeceras.

## Fuera de alcance

- Edición directa sobre la página, borradores y publicación programada.
- Proponer títulos con el título real de cualquier URL (requiere un fetch seguro con allowlist; se evalúa más adelante).
- Avatar animado, Shop e íconos de atajo (hoja de ruta v3).

## Criterios de éxito

- [ ] Puedo armar mi página completa desde el celular, sin teclado físico.
- [ ] Todo el editor se puede usar solo con teclado y con lector de pantalla (recorrido documentado).
- [ ] Cada cambio se ve en la vista previa en menos de 1 s y en la página pública en menos de 5 s.
- [ ] Un `member` no puede ver ni invocar nada de `/admin/usuarios` (E2E + pgTAP).
- [ ] Cada fila de la tabla de amenazas tiene su test, en verde en CI.
- [ ] La isla `Editor` pesa ≤ 120 KB gzip, React y @dnd-kit/react incluidos (subido de 90 el 2026-10-23 para el arrastre), y no se carga fuera de `/admin`. El presupuesto original era de 60 KB, pero React 19 solo ya pesa ~67 KB. Decisión del 2026-10-23: seguir con React y ajustar el presupuesto; lo controla `scripts/island-budget.ts` en la CI.

## Preguntas abiertas

1. ~~Tiempo para deshacer~~ Aprobado: 6 segundos.
