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

## Entrega 7c · Vista previa del artículo (se detalla y se aprueba antes de empezar)

Al agregar un `article`, Plektia lee la página y propone el título, la descripción y la imagen
(`og:title`, `og:description`, `og:image`). Es pedir páginas de terceros desde el servidor, así que
lleva estas salvaguardas mínimas:

- **Quién y cómo:** solo el dueño, desde el panel y con rate limit. Solo `https:`, sin
  credenciales, solo puertos 443 o por defecto, hasta 3 redirecciones (cada una se revalida),
  `timeout` de 5 s y lectura de hasta 512 KB de HTML.
- **Qué se usa:** solo se parsean esas tres etiquetas, y el texto pasa por las mismas reglas de
  título y descripción. Nunca se guarda ni se muestra HTML del sitio.
- **La imagen:** se descarga una sola vez y solo si es JPEG, PNG o WebP. Se verifican los bytes
  mágicos, el tamaño (hasta 1 MB) y las dimensiones. Se guarda en el bucket propio y se sirve desde
  el sitio, así que la CSP no cambia (`img-src 'self'`). Nunca se enlaza la imagen original.
- **Si algo falla:** el link se agrega igual, sin vista previa.

## Fuera de alcance

- Conectar cuentas por OAuth con cada red.
- Leer seguidores, publicaciones o estadísticas de las redes.
- Vista previa automática de sitios o videos (7c es solo para artículos).

## Preguntas abiertas

1. ¿La vista previa (7c) se muestra en la página pública como tarjeta con imagen, o solo propone el
   título y la descripción en el panel? Se decide al detallar 7c.
