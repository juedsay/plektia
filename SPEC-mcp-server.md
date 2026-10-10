# Spec: `mcp-server`

> Módulo del [mapa de capacidades](CAPABILITY-MAP.md). Depende de
> [`identity`](SPEC-identity.md) y [`links`](SPEC-links.md); usa también
> [`live-status`](SPEC-live-status.md) y [`click-analytics`](SPEC-click-analytics.md).
> Hereda las convenciones de [`platform`](SPEC-platform.md). Estado: **borrador, pendiente de aprobación**.

## Objetivo

Que el dueño gestione su página desde su agente de IA (Claude u otro cliente MCP) con pedidos como "agregá mi nuevo video a Proyectos", "ocultá Instagram", "¿qué link se tocó más esta semana?" o "avisá que estoy en vivo". El agente tiene **los mismos permisos que el dueño y ni uno más**, y el dueño decide si puede solo leer o también modificar.

### Historias y criterios de aceptación

1. **Conectar.** En Claude agrego el conector remoto `https://<dominio>/mcp`. El cliente descubre solo cómo autenticarse, me lleva a iniciar sesión en Plektia (GitHub o Google) y me muestra una **pantalla de consentimiento** con:
   - el nombre del cliente y el host al que va a volver;
   - un aviso de que el nombre lo declara la app y no está verificado;
   - la elección del nivel de permiso: **"Solo lectura"** o **"Lectura y edición"**.
2. **Usar.** Desde el agente puedo ver mi página, crear, editar, ocultar, mover y borrar links y secciones, cambiar el contenido destacado de YouTube, activar o desactivar la vigilancia en vivo, pedir "Comprobar ahora" y consultar estadísticas.
3. **Borrar con cuidado.** Las herramientas que borran se marcan como destructivas y exigen confirmar con el título exacto del elemento. Así un pedido ambiguo no borra lo que no era.
4. **Ver y revocar conexiones (`/admin/conexiones`).** Veo cada app conectada con su nombre, host, permiso, fecha de alta y último uso. Puedo cambiarle el permiso o revocarla, y la revocación corta el acceso de inmediato.
5. **Trazabilidad.** Cada cambio hecho por MCP queda en `private.audit_log` con la app y la herramienta usadas, y el panel muestra "Editado desde Claude" en el aviso de conflicto si corresponde.

## Autenticación (OAuth 2.1 con Supabase)

```
Cliente MCP ──► POST /mcp (sin token)
            ◄── 401 + WWW-Authenticate: resource_metadata=/.well-known/oauth-protected-resource
            ──► descubre el authorization server de Supabase Auth (RFC 8414)
            ──► registro dinámico del cliente (DCR) + /authorize con PKCE
                    └─► Supabase redirige a /oauth/consent?authorization_id=…
                          (login de identity si no hay sesión → pantalla de consentimiento
                           → approveAuthorization / denyAuthorization)
            ◄── access token (JWT de Supabase con claim client_id) + refresh token
            ──► POST /mcp con Bearer → verificación → herramientas
```

- **Metadatos del recurso protegido (RFC 9728):** se sirven en `/.well-known/oauth-protected-resource` con `oauthMetadataResponse` del SDK y apuntan al *authorization server* de Supabase.
- **Verificación del token en cada request:**
  - firma con el JWKS del proyecto (ES256);
  - `iss` del proyecto, `aud = authenticated`, `exp` vigente;
  - **claim `client_id` presente**: rechaza los tokens de sesión del panel;
  - un **grant activo** en `mcp_grants` para ese `client_id` y usuario.
- **Pantalla de consentimiento:** ruta `/oauth/consent`, server-side. `getAuthorizationDetails`, `approveAuthorization` y `denyAuthorization` se ejecutan en una Action, con el cliente de servidor de `identity`. Al aprobar se crea o actualiza el grant con el nivel elegido.
- **Riesgo conocido 1:** el servidor OAuth de Supabase está en **beta**.
- **Riesgo conocido 2:** no soporta *resource indicators* (RFC 8707), así que el token no queda atado a nuestro servidor. Lo compensan la exigencia de `client_id`, la vida corta del token (1 h), el grant revocable y las protecciones de la sección siguiente.

### Que el token no sirva para saltearse el MCP

Como el access token es un JWT de usuario válido, el cliente podría usarlo **directo contra la API REST de Supabase**. Para que los permisos sean reales:

- Las políticas de escritura de `links`, `sections`, `link_media_settings` y `profiles` suman la condición `(auth.jwt() ->> 'client_id') is null`. **Solo las sesiones propias del panel escriben directo en las tablas.**
- El MCP escribe mediante funciones `mcp_*` (`security definer`), que:
  1. verifican que el grant exista, esté activo y tenga `can_write`;
  2. aplican `owner_id = auth.uid()`;
  3. registran la auditoría;
  4. ejecutan la misma operación con las mismas restricciones de la base.
- La lectura directa queda limitada por RLS a lo que el dueño ya puede ver.

```sql
create table public.mcp_grants (
  client_id    uuid not null,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  client_name  text not null,
  redirect_host text not null,
  can_write    boolean not null default false,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz,
  primary key (client_id, user_id)
);
```

- RLS: el dueño lee y actualiza `can_write` y `revoked_at` de sus propios grants.
- **Revocar:** llama a `supabase.auth.oauth.revokeGrant(clientId)`, que invalida los refresh tokens y las sesiones del cliente, y marca `revoked_at`. El access token vigente queda rechazado de inmediato por el chequeo del grant.

## Servidor MCP

- **Endpoint:** `/mcp` en el mismo Worker, con `@modelcontextprotocol/sdk` 1.x, transporte **Streamable HTTP sin estado** (`WebStandardStreamableHTTPServerTransport`) y `requireBearerAuth` con nuestro verificador.
- **Cabeceras:** `Cache-Control: no-store`; CORS solo para los métodos y cabeceras que exige el protocolo.
- **Herramientas como adaptador fino:** cada tool valida sus argumentos con los **mismos schemas Zod** de `domain` y llama al **mismo caso de uso** que el panel. La única diferencia es el adaptador de escritura (`McpRpcLinkWriter`, que usa las funciones `mcp_*`). Así se aplica la inversión de dependencias de [`platform`](SPEC-platform.md).
- **Rate limit:** 60 llamadas por minuto por usuario y cliente. Las escrituras purgan la caché de la página igual que el panel.

| Herramienta | Permiso | Anotaciones | Descripción |
|---|---|---|---|
| `get_page` | lectura | `readOnlyHint` | Perfil, secciones y links (incluidos los ocultos), con IDs y `version` |
| `get_stats` | lectura | `readOnlyHint` | Visitas, clics, CTR, países y orígenes de un período |
| `create_link` | edición | — | Crea un link en una sección o en "Sin sección" |
| `update_link` | edición | `idempotentHint` | Título, URL, descripción, etiquetas; exige `version` |
| `set_visibility` | edición | `idempotentHint` | Oculta o muestra un link o una sección |
| `move_links` | edición | — | Reordena o mueve links (orden final completo) |
| `delete_link` | edición | `destructiveHint` | Exige `confirm_title` igual al título actual |
| `create_section` / `update_section` | edición | — | Crear, renombrar, mostrar u ocultar el título |
| `reorder_sections` | edición | — | Orden final completo |
| `delete_section` | edición | `destructiveHint` | Exige `confirm_title`; sus links pasan a "Sin sección" |
| `set_featured_content` | edición | `idempotentHint` | Modo de contenido destacado de un link de YouTube |
| `set_live_watch` | edición | `idempotentHint` | Activa o desactiva "Transmito en este canal" |
| `check_live_now` | edición | — | "Comprobar ahora" (el mismo *rate limit* que el panel) |
| `update_profile` | edición | `idempotentHint` | Nombre visible y bio (el avatar no) |

- Las respuestas de las tools devuelven el contenido del usuario (títulos, bios) **como datos**, marcados como tales. Las descripciones de las tools aclaran que ese texto no son instrucciones (defensa básica contra *prompt injection*).
- Los errores salen del mismo mapa en español que el panel, con `isError: true`.

## Seguridad: amenazas y mitigaciones

| Amenaza | Mitigación | Test |
|---|---|---|
| Token falsificado, vencido o de otro proyecto | Verificación de firma con JWKS, `iss`, `aud` y `exp` | Integración: token alterado, vencido o de otro emisor → 401 |
| Usar un token de sesión del panel contra `/mcp` | Exigir `client_id` | Integración → 401 |
| Saltearse el MCP con el token contra la API REST | Políticas de escritura con `client_id is null`; escrituras solo vía `mcp_*` | pgTAP: un JWT con `client_id` no puede hacer `insert`/`update`/`delete` directos |
| Grant de solo lectura que escribe | `mcp_*` verifica `can_write` | pgTAP + integración |
| Seguir usando un cliente revocado | Chequeo de grant en cada request + `revokeGrant` | Integración: revocar → la siguiente llamada da 401 |
| Phishing de consentimiento (app que se llama "Claude" pero no lo es) | La pantalla muestra el host de `redirect_uri` destacado y avisa "nombre no verificado"; el permiso por defecto es solo lectura | E2E de la pantalla de consentimiento |
| CSRF o clickjacking en el consentimiento | Action POST con `checkOrigin`; `frame-ancestors 'none'` | E2E |
| Borrado masivo por un pedido ambiguo del agente | `destructiveHint` + `confirm_title` exacto; sin herramientas de borrado en lote | Integración: un título distinto rechaza el borrado |
| *Prompt injection* desde el contenido del usuario | Contenido marcado como datos; ninguna tool ejecuta acciones a partir del texto devuelto | Revisión + test de formato de salida |
| Abuso o bucles del agente | Rate limit por usuario y cliente; límites de `links` | Integración |
| Fuga de datos de otros usuarios | Toda lectura pasa por RLS con el `sub` del token | pgTAP + integración con dos usuarios |

## Testing

- **Unit:** cada tool con casos de uso falsos (mapeo de argumentos, errores y `confirm_title`) y el verificador de tokens con claves de prueba.
- **Contrato MCP:** el cliente del SDK contra el servidor en memoria lista las tools, valida los schemas y prueba cada tool contra Supabase local.
- **pgTAP:** las políticas con `client_id` (lectura sí, escritura directa no), las funciones `mcp_*` (grant, `can_write`, dueño y auditoría) y `mcp_grants`.
- **Integración:** el flujo OAuth completo contra Supabase local (DCR → autorización → consentimiento → token → `/mcp`), la revocación y el rate limit.
- **E2E:** la pantalla de consentimiento (permiso por defecto en solo lectura, host destacado, aprobar y denegar) y `/admin/conexiones` (cambiar permiso y revocar).
- **Manual documentada:** conectar desde Claude real y ejecutar el recorrido de las historias.

## Fuera de alcance

- Subir el avatar o cambiar el tema por MCP.
- *Resources* y *prompts* de MCP (solo tools en la v1).
- Herramientas de owner (invitar o revocar usuarios) por MCP.
- Clientes con credenciales propias (máquina a máquina) y tokens personales sin OAuth.

## Criterios de éxito

- [ ] Conecto Claude a Plektia en menos de un minuto, sin copiar tokens a mano.
- [ ] Con "Solo lectura", ninguna escritura funciona, ni por MCP ni con el token directo contra Supabase (pgTAP + integración).
- [ ] Revocar una conexión corta el acceso en la siguiente llamada.
- [ ] Todos los cambios por MCP aparecen en la página pública en menos de 5 s y en la auditoría.
- [ ] Cada fila de la tabla de amenazas tiene su test, en verde en CI.

## Preguntas abiertas

1. ¿Te sirve que "Solo lectura" sea el permiso por defecto en la pantalla de consentimiento, o preferís que venga marcado "Lectura y edición"?
