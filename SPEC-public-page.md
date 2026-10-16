# Spec: `public-page`

> Módulo del [mapa de capacidades](CAPABILITY-MAP.md). Depende de
> [`links`](SPEC-links.md) y de `brand-system` ([DESIGN.md](DESIGN.md)). Hereda las
> convenciones de [`platform`](SPEC-platform.md). Estado: **aprobado (2026-10-10)**.

## Objetivo

Servir la página pública de cada usuario (`/{handle}`) tal como la define el prototipo aprobado en [`prototypes/public-page/`](prototypes/public-page/index.html) y [DESIGN.md](DESIGN.md): rápida como una página estática, accesible al nivel AAA y sin rastreo de terceros. Incluye también la página "Sobre Plektia" y la política de privacidad.

**Usuario principal:** el visitante que llega desde la bio de una red social, en el celular y con datos móviles.

### Historias y criterios de aceptación

1. **Ver la página.** Al abrir `/juedsay` veo el avatar, el nombre y la bio, y las secciones visibles con sus links en el orden que eligió el dueño, unidos por el hilo. "Sin sección" va al final y sin título.
2. **En vivo.** Si el dueño está transmitiendo, el link correspondiente muestra "En vivo", el tiempo transcurrido y el título del stream, con el jack en lima latiendo. El dato llega de `live-status`; esta página solo lo muestra.
3. **Último video.** El link de YouTube muestra una sub-fila plegada con el título y la antigüedad del último video. Al desplegarla aparece la miniatura, que **recién en ese momento** se pide a YouTube.
4. **Compartir.** El botón de arriba a la derecha abre una ventana propia (tarea 16b): una tarjeta de vista previa, copiar el link, las redes principales como links que se abren al tocarlos y "Más opciones" para la hoja nativa. Mientras tanto usa la hoja nativa y, si no existe, copia el link y lo avisa.
5. **Página oficial de Plektia.** El isotipo de arriba a la izquierda lleva a la landing (`/`) y el pie, a `/plektia`, la página de la marca (como `linktr.ee/linktr.ee`): el mismo diseño que la de un usuario, con el isotipo como avatar, una bio que explica qué es Plektia y que por ahora funciona por invitación, y secciones como "Novedades", "Sobre Plektia" y "Legal". Su contenido vive en el repo (`src/content/plektia.ts`) y se valida con los mismos schemas del dominio que los links de usuarios.
6. **Contacto.** `/plektia/contacto` tiene un formulario (nombre, email, mensaje) que nunca expone el correo de Plektia. Los mensajes se guardan en la base y se leen desde el panel; con dominio propio, además llega un aviso por mail. Contra el spam: un campo trampa invisible, un límite de envíos por IP y Turnstile (que carga un script de Cloudflare solo en esta página).
7. **Privacidad.** El pie lleva a `/plektia/privacidad`, que explica en lenguaje simple qué se mide (clics por link, sin cookies ni datos personales) y qué terceros intervienen (YouTube, solo si el visitante despliega la miniatura).
8. **Raíz del dominio.** `/` es la landing de Plektia (como `linktr.ee/`): una sola pantalla que explica qué es, muestra un ejemplo de página, aclara que por ahora funciona por invitación y lleva a `/plektia` y a entrar.
9. **Handle inexistente.** Devuelve una página 404 con el mismo diseño y un link a `/plektia`.

## Diseño de la página

Sigue [DESIGN.md](DESIGN.md) y el prototipo; acá solo se fija lo que el prototipo no resuelve.

- **Encabezado:** isotipo (→ `/`), compartir, avatar centrado, nombre (`display_name`), `@handle` en chico debajo (salvo que el usuario lo oculte con `profiles.show_handle`) y la bio. Ocultarlo es solo de presentación: el handle sigue en la URL.
- **Pie:** isotipo + "Hecho con Plektia" (→ `/plektia`) · "Privacidad". No hay "Reportar", "Legal" ni preferencias de cookies en la v1: la página no usa cookies, y el resto llega cuando abra el registro.
- **Tema:** el atributo `data-theme` sale de `profiles.theme`. En la v1 solo existe `tecnico`.
- **Links:** se abren en la misma pestaña, porque en los navegadores embebidos de las apps sociales una pestaña nueva confunde. Los links a perfiles propios llevan `rel="me"`, que sirve para verificación cruzada (por ejemplo en Mastodon).
- **Datos que agrega este módulo** (migración propia): `profiles.theme` (enum, por defecto `tecnico`) `profiles.avatar_path` (ruta en Supabase Storage; la subida pertenece a `admin-panel`) y `profiles.show_handle` (booleano, por defecto `true`; se edita en `/admin/perfil`). La vista `public_page_v` expone `show_handle`. `plektia` se suma a los handles reservados de `identity`.

## Render y caché

| Ruta | Render | Caché |
|---|---|---|
| `/{handle}` y `/` | On-demand en el Worker. Una sola consulta a `public_page_v`, que incluye el estado en vivo y el último video | [Workers Cache](https://developers.cloudflare.com/workers/cache/): `Cache-Control: public, max-age=60, stale-while-revalidate=300` y `Cache-Tag: profile:{handle}`. Al editar desde el panel o el MCP, y cuando el cron cambia el estado en vivo, el Worker llama a `ctx.cache.purge({ tags: ["profile:{handle}"] })` y el cambio se ve al instante. Funciona en `workers.dev` y no necesita token de API |
| `/` (landing), `/plektia`, `/plektia/privacidad`, `/plektia/contacto` | On-demand en el Worker, sin consultar la base. No se prerenderizan porque los archivos estáticos no pasan por el middleware y saldrían sin las cabeceras de seguridad | Las de la tarea 17 |
| 404 | On-demand | `s-maxage=60` |

- La clave de caché es solo la ruta: los query strings no generan variantes. Así se evita el envenenamiento de caché y se aprovecha mejor.
- Las rutas autenticadas (`/admin`, `/auth`, `/mcp`) responden `Cache-Control: private, no-store`; además, la caché se saltea sola ante `Set-Cookie` o `Authorization`. Un test E2E lo verifica.
- **A verificar al implementar:** la purga está limitada al *entrypoint* que cachea. Hay que confirmar que el handler `scheduled` del cron comparte entrypoint con el `fetch` de Astro, o purgar a través de un *service binding* propio.
- El tiempo en vivo sale del servidor como `started_at`; el reloj corre en el cliente.
- **JavaScript:** solo los tres scripts del prototipo (hilo, disclosure del video, compartir), sin React, como módulos ES con `defer`.
- **Fuente:** Bricolage Grotesque servida desde el propio sitio con `@fontsource-variable/bricolage-grotesque`, solo el subset latino en woff2, con `font-display: swap` y métricas de respaldo ajustadas para que el cambio de fuente no mueva el layout. Es el compromiso que quedó abierto en la revisión de diseño.

## Presupuestos de rendimiento

Se miden en CI con Lighthouse sobre perfil de celular y 4G lento:

| Métrica | Presupuesto |
|---|---|
| LCP | ≤ 1.5 s |
| CLS | 0 |
| TBT | ≤ 50 ms |
| JS (gzip) | ≤ 8 KB |
| CSS (gzip) | ≤ 12 KB |
| HTML (gzip) | ≤ 30 KB con 50 links |
| Requests de terceros al cargar | 0 |
| Lighthouse | ≥ 95 en las cuatro categorías |

## SEO y metadatos

- `<title>`: `{display_name} · Plektia`. `description` sale de la bio.
- Open Graph y Twitter Card con avatar, nombre y bio. Una imagen OG generada queda para más adelante.
- `<link rel="canonical">` a `/{handle}`, y JSON-LD `ProfilePage` con `Person` y `sameAs`, que toma los links de perfiles propios.
- `sitemap.xml` con los perfiles públicos y `robots.txt` permisivo, salvo `/admin` y `/auth`.

## Seguridad y privacidad: amenazas y mitigaciones

| Amenaza | Mitigación | Test |
|---|---|---|
| XSS con título, bio o descripción | Astro escapa todo; prohibido `set:html` con datos de usuario (regla de Semgrep) | E2E: un perfil con `<script>` y `<img onerror>` en todos los campos se ve como texto |
| URLs peligrosas en `href` | Validadas en `links`; el render vuelve a pasar `parseSafeUrl` como defensa en profundidad | Unit |
| Clickjacking | CSP `frame-ancestors 'none'` | E2E de cabeceras |
| Fuga de datos a terceros | 0 requests de terceros al cargar; la miniatura de YouTube solo al desplegar; `Referrer-Policy: strict-origin-when-cross-origin` | E2E: registrar la red al cargar y comprobar que solo hay pedidos al propio dominio y al Storage del avatar |
| Envenenamiento de caché | Clave de caché solo por ruta; sin cabeceras del pedido en la respuesta | Integración |
| Ver contenido oculto | La vista pública solo trae lo visible (RLS de `links`) | E2E: un link oculto no aparece en el HTML |
| CSP demasiado permisiva | `img-src 'self' <storage> https://i.ytimg.com`; `script-src 'self'` con hashes; `connect-src 'self'`; `font-src 'self'` | E2E: la CSP exacta |
| Seguimiento del visitante | Sin cookies ni identificadores en la página pública | E2E: la respuesta no trae `Set-Cookie` |

## Accesibilidad (WCAG 2.2 AAA)

- Contraste ≥ 7:1 en todo el texto (los tokens ya están verificados) y blancos táctiles ≥ 44 px.
- Orden de foco lógico y foco visible en hueso.
- El hilo es decorativo (`aria-hidden`). El estado en vivo está en texto, no solo en color.
- La disclosure del video usa `aria-expanded`/`aria-controls` y deja el panel cerrado como `inert`.
- `prefers-reduced-motion` quita el enhebrado, la tensión y el pulso.
- El idioma de la página es `lang="es-AR"`, y el contenido de usuario puede declarar el suyo más adelante.

## Código

| Capa | Archivo | Responsabilidad |
|---|---|---|
| application/public | `get-public-page.ts` (de `links`) | Modelo de lectura |
| domain | `relative-time.ts`, `live-duration.ts` | "hace 2 días" en es-AR y la duración en vivo (funciones puras) |
| ui/components | `ProfileHeader.astro`, `Bank.astro`, `Port.astro`, `LatestVideo.astro`, `Footer.astro` | Los componentes del prototipo |
| ui/scripts | `thread.ts`, `disclosure.ts`, `share.ts` | Los tres scripts del prototipo, tipados |
| ui/styles | `tokens.css`, `public-page.css` | Tokens de DESIGN.md |
| pages | `[handle].astro`, `index.astro`, `plektia/index.astro`, `plektia/privacidad.astro`, `404.astro` | Rutas finas |

## Testing

- **Unit:** `relative-time` (límites: ahora, minutos, ayer, semanas), `live-duration`, el mapeo del modelo de lectura (orden, "Sin sección" al final, ocultos fuera) y `thread.ts` con DOM simulado (el hilo nunca entra en la columna de texto con 1.000 semillas al azar).
- **Integración:** la ruta `[handle]` con un repositorio falso devuelve 200, 404 y las cabeceras de caché correctas.
- **E2E (Playwright):**
  - render completo;
  - badge en vivo;
  - disclosure con teclado;
  - compartir con fallback a copiar;
  - 404;
  - axe con reglas AAA;
  - CSP y demás cabeceras;
  - sin cookies y sin requests de terceros al cargar.
- **Rendimiento:** Lighthouse CI con los presupuestos de arriba; falla el PR si se excede alguno.
- **Visual:** capturas de referencia a 390 y 1440 px con la semilla del hilo fija (parámetro solo de test).

## Fuera de alcance

- Los otros 3 temas (entrega propia sobre el mismo contrato de tokens).
- Filtros por etiqueta, imagen OG generada y la variante "patchera + subte".
- "Reportar", "Legal" y "Explorar" (cuando abra el registro).
- Actualizar el estado en vivo sin recargar la página.

## Criterios de éxito

- [ ] `/juedsay` se ve igual que el prototipo aprobado (comparación visual a 390 y 1440 px).
- [ ] Todos los presupuestos de rendimiento se cumplen en CI.
- [ ] axe no reporta violaciones AAA, y el recorrido con teclado y lector de pantalla está documentado.
- [ ] Al cargar no hay cookies ni requests a terceros.
- [ ] Una edición desde el panel se ve en la página pública en menos de 5 segundos (purga de caché).
- [ ] `/plektia` y `/plektia/privacidad` publicadas, y la política refleja lo que realmente se mide.

## Preguntas abiertas

1. ~~Purga de caché~~ Resuelto: cambios al instante con Workers Cache y purga por etiqueta desde el propio Worker, sin token de API. Se descartó pasar a Vercel.
