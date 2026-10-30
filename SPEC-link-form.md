# Spec: `link-form`

> Módulo del [mapa de capacidades](CAPABILITY-MAP.md). Extiende [`links`](SPEC-links.md),
> [`admin-panel`](SPEC-admin-panel.md) y [`public-page`](SPEC-public-page.md). Hereda las
> convenciones de [`platform`](SPEC-platform.md).
> Estado: **aprobado (2026-10-29)**.

## Objetivo

Que agregar un link sea simple y entendible. Para una red social se elige la red y se escribe el
usuario, sin pegar la URL completa. Un artículo, un video o un sitio se distinguen en la página de
un perfil de red.

Decisiones del 2026-10-29:

- **Botones de redes** arriba del formulario, con las 11 redes que el proyecto ya reconoce, más
  "Otro link". Las 6 más usadas quedan a la vista y el resto va en "Más…".
- **Tipo de link** (red social, artículo, video o sitio), con tres partes:
  - se detecta solo y se puede cambiar;
  - en "Otro link" también se elige al agregarlo;
  - y en una entrega aparte, una vista previa que trae el título y la imagen del artículo.
- **Sin conexión por OAuth con cada red.** Instagram exige cuenta profesional y la revisión de
  Meta, y habría que guardar tokens de terceros solo para obtener un usuario que se puede escribir.

## Entrega 7a · Elegir la red y escribir el usuario

### Historias y criterios de aceptación

1. **Elegir la red.** Arriba de "Agregar un link" hay una fila de botones con el ícono y el nombre
   de cada red: Instagram, YouTube, TikTok, X, Twitch y GitHub a la vista; Kick, LinkedIn,
   Facebook, Threads y Bluesky en "Más…"; y "Otro link". Es un grupo de botones con
   `aria-pressed`, con objetivos de 44 px, que funciona con el teclado.
2. **Escribir el usuario.** Con una red elegida, el campo pasa a ser "Usuario", con el dominio como
   prefijo visible (`instagram.com/`, `youtube.com/@`, `linkedin.com/in/`…). Se acepta
   `juedsay`, `@juedsay` o la URL completa pegada: si es de esa red, se toma el usuario.
3. **El resto se completa solo.** El título propuesto es el nombre de la red (como hoy) y la URL se
   arma con la plantilla de la red. Antes de agregar, se muestra la URL final ("Se va a abrir
   instagram.com/juedsay").
4. **Validación con las mismas reglas.** El usuario se valida con el formato de cada red. La URL
   armada tiene que volver a reconocerse como el perfil de ese usuario (la ida y la vuelta usan las
   mismas reglas de `social-profile`). El servidor no cambia: recibe una URL y la valida como
   siempre.
5. **Otro link.** Es el formulario de hoy: URL completa y título propuesto. Si se pega la URL de una
   red conocida, se ofrece pasar a esa red ("Es un perfil de Instagram: ¿lo cargamos así?").
6. **Lo recuerda.** Después de agregar, la red elegida queda seleccionada para cargar otra, y el foco
   vuelve al campo.

### Diseño

- **Plantillas** en `src/ui/view/profile-url.ts`, junto a las reglas de `social-profile` (la isla del
  editor ya las carga; sin zod):

  | Red | URL |
  |---|---|
  | Instagram | `https://www.instagram.com/{usuario}` |
  | YouTube | `https://www.youtube.com/@{usuario}` |
  | TikTok | `https://www.tiktok.com/@{usuario}` |
  | X | `https://x.com/{usuario}` |
  | Twitch | `https://www.twitch.tv/{usuario}` |
  | Kick | `https://kick.com/{usuario}` |
  | GitHub | `https://github.com/{usuario}` |
  | LinkedIn | `https://www.linkedin.com/in/{usuario}` |
  | Facebook | `https://www.facebook.com/{usuario}` |
  | Threads | `https://www.threads.net/@{usuario}` |
  | Bluesky | `https://bsky.app/profile/{usuario}` |

  `profileUrlFor(network, input)` normaliza la entrada (sin `@`, sin espacios, o la URL pegada) y
  devuelve la URL o un error con el formato esperado. Los formatos y la lista de rutas reservadas
  siguen en `social-profile`.
- **Presupuesto:** los logos de las redes suman unos 4 KB a la isla del editor. El 2026-10-29 el tope
  sube de 120 a 125 KB para mostrarlos (solo los descarga el panel, no la página pública). Los paths
  quedan en `src/ui/view/network-icons.ts`, compartidos con la página pública.

### Pruebas

- **Unit:**
  - `profileUrlFor` en las 11 redes: usuario simple, con `@`, URL pegada, URL de otra red,
    formato inválido y ruta reservada;
  - ida y vuelta con `socialProfileFor`;
  - el formulario con red y usuario arma la URL, muestra la vista previa y recuerda la red.
- **E2E:** agregar un Instagram escribiendo solo el usuario, y que la página pública lo muestre con
  su ícono y "@usuario".
- **axe** del formulario a 390 px y en escritorio.

## Entrega 7b · Tipo de link

- `links.kind`, enum `public.link_kind`: `social` (perfil de red), `article`, `video` o `site`. Es
  **nullable**: `null` es "Automático", y el tipo se deduce de la URL al mostrar el link
  (`src/ui/view/link-kind.ts`). Así los links existentes no necesitan rellenarse, y la regla vive en
  un solo lugar. La base guarda solo lo que el dueño elige a mano.
- **Detección:**
  - un perfil de una red conocida es `social`;
  - un video de YouTube (`watch`, `youtu.be`, `shorts`, `live`), Vimeo, TikTok, un reel de Instagram
    o un video o clip de Twitch es `video`;
  - un artículo de Medium, Substack, dev.to, Hashnode o Ghost, una carpeta típica (`/blog/`,
    `/articulos/`, `/p/`, `/posts/`, `/pulse/`…) o un slug de varias palabras con guiones es
    `article`;
  - el resto es `site`.
  - Solo se compara el host exacto: `youtube.com.evil.com` es un sitio.
- **Panel:** selector "Tipo", con "Automático (Artículo)" mostrando lo deducido y las cuatro
  opciones. En el alta aparece con "Otro link", y al editar un link, siempre. Cambiarlo ofrece
  "Deshacer".
- **Página pública:** la línea secundaria de un artículo o un video lo dice adelante, por ejemplo
  "Artículo · medium.com/…" o "Video · Mi charla", en el color secundario (AAA). Los perfiles y los
  sitios se ven como siempre: el ícono de la red y "@usuario", o la dirección.
- **MCP:** `create_link` y `update_link` aceptan `kind` opcional; sin él (o con `null`), se deduce.

## Entrega 7c · Vista previa del artículo

Decisiones del 2026-10-29:

- La vista previa se usa **en la página pública**: el artículo se ve con su imagen chica.
- Se busca **solo con un botón**, "Traer vista previa". Plektia no visita ningún sitio por su
  cuenta.

Va en dos partes chicas.

### 7c-1 · Traer el título y la descripción

1. **El botón.** En el alta ("Otro link") y al editar un link, si su tipo es artículo, aparece "Traer
   vista previa". Propone el título y la descripción del artículo en los campos, y el dueño puede
   cambiarlos antes de guardar. Si el sitio no responde o no tiene esos datos, lo dice y no cambia
   nada.
2. **El pedido** es una Action del panel (`links.fetchPreview`, con la página de la sesión). Solo la
   usa el dueño, tiene su propio rate limit (20 por minuto por cuenta) y no está expuesta por MCP.
3. **Salvaguardas** (`src/infrastructure/http/safe-fetch.ts`):
   - **URL:** solo `https:`, sin usuario ni contraseña, y solo el puerto 443.
   - **Host:** se rechaza una IP literal (v4 o v6), `localhost` y los dominios `.local`, `.internal`,
     `.localhost`, `.test`, `.invalid` y `.arpa`. También el propio dominio de Plektia y
     `*.workers.dev`, para que no pueda llamarse a sí mismo.
   - **Redirecciones:** hasta 3, en modo `manual`, y cada destino se vuelve a validar.
   - **Lectura:** `timeout` de 5 s, solo `text/html`, y se leen como máximo 512 KB del cuerpo; lo demás
     se cancela.
   - **Pedido:** sin cookies ni cabeceras del usuario, con un `User-Agent` propio
     ("PlektiaPreview").
4. **Qué se usa:** solo `og:title`, `og:description`, `og:image` y, como respaldo, `<title>`. Se
   leen con un parser de etiquetas `meta`, no con un DOM. Las entidades HTML se decodifican y el texto
   pasa por las reglas de título (80) y descripción (120), con `…` si se corta. Nunca se guarda ni
   se muestra HTML del sitio.

### 7c-2 · La imagen

1. **Traerla.** Si hay `og:image` (validada con las mismas salvaguardas de 7c-1), el servidor la
   descarga y se la pasa al panel:
   - pesa hasta 2 MB;
   - por sus bytes es JPEG, PNG, WebP o GIF (el `Content-Type` no alcanza);
   - va en base64.
2. **Recodificarla en el navegador.** El panel la dibuja en un canvas recortado a 1.91:1, de 480 × 252,
   y la exporta a WebP, o a JPEG en Safari. Eso descarta metadatos, animaciones y contenido
   escondido, como en el avatar. El dueño la ve antes de guardar y puede sacarla.
3. **Guardarla.** Se sube con una Action (`links.setPreviewImage`) y se valida en el servidor con la
   misma inspección estricta del avatar, generalizada: formato real, 480 × 252, hasta 80 KB, sin
   metadatos y sin animación.
   - Va al bucket `link-previews`, en `{dueño}/{uuid}.webp`, con las mismas políticas de storage
     que los avatares.
   - `links.preview_image_path` guarda la ruta, con un `check` del formato.
   - Al cambiar o sacar la imagen, o al borrar el link desde el panel, se borra el archivo anterior.
    Un link borrado por MCP deja su archivo en la carpeta del dueño (sin enlazar), como un avatar viejo.
4. **Mostrarla.** Se sirve desde `/link-previews/{dueño}/{archivo}` con `nosniff` y caché larga, así
   que la CSP no cambia (`img-src 'self'`). En la página, un artículo con imagen la muestra chica a la
   derecha del texto, con `width`, `height` y `loading="lazy"` y `alt=""`, porque el título ya dice qué
   es. Funciona en las tres formas de link y en el destacado "arriba de todo".

### Pruebas de la 7c

- **Unit:**
  - `safe-fetch` rechaza cada host prohibido, puertos, credenciales, `http:`, y redirecciones de más
    o hacia un host prohibido;
  - corta a los 512 KB y a los 5 s;
  - el parser lee `og:*` con comillas simples, dobles y en otro orden, decodifica entidades y no se
    deja engañar por `<meta>` dentro de un comentario o un `<script>`;
  - la inspección de la imagen recodificada.
- **Integración:** la Action con un servidor falso que responde HTML, redirecciones y una imagen.
- **pgTAP:** `preview_image_path` solo con el formato propio, solo el dueño, y las políticas del
  bucket.
- **E2E:** con un sitio de prueba local, "Traer vista previa" completa título y descripción, la imagen
  se ve en la página pública, y sacarla la borra.

## Fuera de alcance

- Conectar cuentas por OAuth con cada red.
- Leer seguidores, publicaciones o estadísticas de las redes.
- Vista previa automática de sitios o videos (7c es solo para artículos).

## Preguntas abiertas

Ninguna por ahora.
