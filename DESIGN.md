---
name: Plektia
description: Página pública de links como una patchera; cada link es un jack, un hilo los enhebra y lo que está en vivo se enciende.
colors:
  negro-patchera: "#121315"
  hueso: "#f2f2ee"
  hueso-apagado: "#aeb1b7"
  grafito: "#3a3d42"
  grafito-tenue: "#26282c"
  superficie: "#1b1d20"
  lima-en-vivo: "#c6f432"
  tinta-en-vivo: "#121315"
  punto-tostado: "#1f1813"
  punto-crema: "#f6ecdc"
  punto-crema-apagada: "#d8c8b2"
  punto-costura: "#6b5644"
  punto-costura-tenue: "#3d3027"
  punto-retazo: "#3a2e24"
  punto-tenido-en-vivo: "#b3cdff"
  punto-terracota: "#ffb294"
  punto-mostaza: "#e9b949"
  punto-salvia: "#acd2b4"
  punto-avena: "#efe3cc"
  punto-tinta: "#2b2118"
  punto-tinta-apagada: "#4f4135"
  punto-costura-claro: "#b8a283"
  punto-costura-tenue-claro: "#ddcdb0"
  punto-retazo-claro: "#fffaf1"
  punto-tenido-en-vivo-claro: "#1e3a78"
  punto-tinta-en-vivo-claro: "#fbf3e4"
  punto-terracota-claro: "#7a2c12"
  punto-mostaza-claro: "#5c3d00"
  punto-salvia-claro: "#264d31"
typography:
  display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 500
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  data:
    fontFamily: "ui-monospace, Cascadia Mono, SF Mono, Menlo, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    fontFeature: "tnum"
  punto-nombre:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.3
    fontVariation: "'SOFT' 100"
rounded:
  sm: "4px"
  md: "6px"
  full: "50%"
  punto-retazo: "12px"
  punto-pastilla: "1.625rem"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "8": "2rem"
  "10": "2.5rem"
components:
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.hueso}"
    rounded: "{rounded.md}"
    size: "44px"
  icon-button-hover:
    backgroundColor: "{colors.superficie}"
  port-link:
    textColor: "{colors.hueso}"
    typography: "{typography.title}"
    padding: "0.75rem 0"
    height: "3.25rem"
  jack:
    backgroundColor: "{colors.negro-patchera}"
    textColor: "{colors.hueso}"
    rounded: "{rounded.full}"
    size: "18px"
  jack-live:
    backgroundColor: "{colors.lima-en-vivo}"
    textColor: "{colors.lima-en-vivo}"
    rounded: "{rounded.full}"
    size: "18px"
  bank-title:
    textColor: "{colors.hueso}"
    typography: "{typography.headline}"
    padding: "0 0 0.75rem"
  latest-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.hueso}"
    typography: "{typography.body-sm}"
    padding: "0.5rem 0"
    height: "44px"
  avatar:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.hueso}"
    rounded: "{rounded.full}"
    size: "88px"
  duration-badge:
    backgroundColor: "{colors.negro-patchera}"
    textColor: "{colors.hueso}"
    typography: "{typography.data}"
    rounded: "{rounded.sm}"
    padding: "0 0.25rem"
  toast:
    backgroundColor: "{colors.hueso}"
    textColor: "{colors.negro-patchera}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  punto-retazo:
    backgroundColor: "{colors.punto-retazo}"
    textColor: "{colors.punto-crema}"
    typography: "{typography.punto-nombre}"
    rounded: "{rounded.punto-retazo}"
    padding: "0 1rem"
    height: "3.25rem"
  punto-retazo-pastilla:
    backgroundColor: "{colors.punto-retazo}"
    textColor: "{colors.punto-crema}"
    rounded: "{rounded.punto-pastilla}"
    padding: "0 1.25rem"
  punto-retazo-en-vivo:
    backgroundColor: "{colors.punto-tenido-en-vivo}"
    textColor: "{colors.punto-tostado}"
    rounded: "{rounded.punto-retazo}"
  punto-retazo-claro:
    backgroundColor: "{colors.punto-retazo-claro}"
    textColor: "{colors.punto-tinta}"
    rounded: "{rounded.punto-retazo}"
  punto-retazo-en-vivo-claro:
    backgroundColor: "{colors.punto-tenido-en-vivo-claro}"
    textColor: "{colors.punto-tinta-en-vivo-claro}"
    rounded: "{rounded.punto-retazo}"
---

# Design System: Plektia

## Overview

**Creative North Star: "La patchera"**

La página pública de Plektia es un panel de conexiones de estudio: cada link es un puerto con su jack anillado, y un hilo trenzado color hueso los enhebra a todos de arriba abajo, empezando con un nudo y terminando suelto. Lo que está en vivo se enciende en lima: el jack late y el tramo de hilo que llega a él cambia de color. Todo lo demás conserva brillo pleno; nada se ve apagado ni viejo. El mundo rechaza la columna de botones redondeados centrados típica de la categoría: acá no hay tarjetas, ni píldoras, ni sombras de elevación.

Es un sistema oscuro, plano y de una sola columna angosta (30rem), pensado para el celular dentro del navegador embebido de una red social, de noche y con datos móviles. La densidad es de lista: filas de 3.25rem separadas por filetes de 1 px, títulos de sección a tamaño real en la voz de la marca, y metadatos chicos en gris claro. El hilo es la única pieza expresiva y vive en su propio carril, a la izquierda del texto; su forma cambia en cada carga.

El sistema es un **contrato de tokens tematizable**: la v1 trae el tema "técnico" (el que documenta este archivo) y el producto va a ofrecer cuatro temas elegibles por el usuario (técnico, cercano, enérgico, editorial). Cada tema redefine el mismo set de variables; los componentes nunca leen colores sueltos.

**Key Characteristics:**
- Fondo negro casi neutro, texto hueso, lima reservada a la señal en vivo.
- Una columna de 30rem con un carril de jacks a la izquierda y el texto a la derecha.
- Hilo SVG trenzado, con forma aleatoria por carga, que nunca cruza el texto.
- Plano: separación por filetes de 1 px, sin sombras de elevación ni tarjetas.
- Bricolage Grotesque para nombres y títulos; fuente del sistema para cuerpo y metadatos; monoespaciada tabular para tiempos.
- WCAG 2.2 AAA en la página pública, en todos los temas.

**Variante en reserva (sin decidir):** existe una dirección alternativa, "fusión patchera + subte" (una línea troncal con nodos y las secciones como tramos de línea de color). No forma parte del sistema; queda registrada solo como posible opción de layout futura, quizá como segundo estilo de página elegible.

## Colors

Una paleta casi monocroma de negro frío y hueso cálido, con un único acento ácido que solo significa "en vivo".

### Primary
- **Lima en vivo** (`lima-en-vivo`): la señal de transmisión en curso y nada más. Se usa en el aro y el ojo del jack en vivo, en su pulso, en el tramo de hilo que llega a ese jack, en la etiqueta "En vivo" y su cronómetro, y en el nodo de acento del isotipo. Sobre el fondo da 14.5:1.
- **Tinta en vivo** (`tinta-en-vivo`): el color de texto previsto sobre una superficie lima, si alguna vez hace falta.

### Neutral
- **Negro patchera** (`negro-patchera`): fondo de toda la página, el ojo de los jacks en reposo, el anillo interior del avatar, el fondo del badge de duración y el color de las marcas del trenzado del hilo. También es el `theme-color` del navegador.
- **Hueso** (`hueso`): texto principal (16.6:1 sobre el fondo), el aro de los jacks, el hilo, los íconos, el anillo exterior del avatar, el contorno de foco y el fondo de la selección y del aviso flotante.
- **Hueso apagado** (`hueso-apagado`): bio, metadatos de cada link, flecha de salida en reposo y pie. Da 8.6:1 sobre el fondo y 7.9:1 sobre la superficie: es el piso de contraste para texto secundario.
- **Grafito** (`grafito`): filete inferior de los títulos de sección, línea punteada del último video, borde interior del ojo del jack y la barra de scroll. Solo para trazos, nunca para texto.
- **Grafito tenue** (`grafito-tenue`): filete de 1 px entre filas de links.
- **Superficie** (`superficie`): fondo del avatar, hover de los botones de ícono y fondo de la miniatura de video.

### Named Rules
**La regla de la señal única.** La lima es exclusiva del en vivo. Si nadie transmite, la página no tiene lima salvo el nodo del isotipo. Foco, selección, hover y estados activos usan hueso, nunca lima.

**Modo claro (desde la Entrega 6, [SPEC-appearance](SPEC-appearance.md)).** Cada estilo tiene modo oscuro y claro, y el dueño elige Oscuro, Claro o Automático (el del dispositivo de quien visita, por `prefers-color-scheme`). En claro, "técnico" es papel (`#f5f4ef`) y tinta (`#16171a`), con el secundario en `#43464d`. La señal en vivo pasa de lima a **verde musgo** (`#2e5200`, 8.2:1), igual de exclusiva. `tests/unit/ui/tokens.test.ts` mide el AAA de cada modo.

**La regla del contrato de tokens.** Los componentes leen solo variables (`--color-*`, `--font-*`, `--text-*`, `--space-*`, `--radius-*`); ningún color literal en componentes. Un tema nuevo (cercano, enérgico, editorial) se activa con `data-theme` y redefine el set completo, incluido `--color-live`, `--color-focus` y `--color-selection-*`. Todo tema debe cumplir WCAG 2.2 AAA en la página pública: 7:1 para texto, 4.5:1 para texto grande, medido contra su propio fondo y su superficie. En un tema claro la lima no alcanza: hay que definir otra señal en vivo que cumpla.

## Typography

**Display Font:** Bricolage Grotesque, ejes `opsz` 12–96 y `wght` 500–600 (con system-ui de respaldo)
**Body Font:** fuente del sistema (system-ui, -apple-system, Segoe UI, Roboto)
**Label/Mono Font:** ui-monospace (Cascadia Mono, SF Mono, Menlo), solo para cifras

**Character:** una grotesca con carácter, algo excéntrica, para todo lo que es nombre propio (la persona, las secciones, cada link), apoyada en la fuente nativa del dispositivo para lo que es lectura y metadato. La voz de marca aparece donde el visitante busca; el resto no compite.

### Hierarchy
- **Display** (500, 1.75rem, 1.15, -0.01em): nombre de la persona bajo el avatar. Uno por página.
- **Headline** (600, 1.25rem, 1.2, -0.01em, `font-optical-sizing: auto`): títulos de sección (Redes, Proyectos, Artículos), en el caso que escribe el usuario, con filete grafito debajo y alineados al inicio de la columna de texto.
- **Title** (500, 1.0625rem, 1.3): nombre de cada link.
- **Body** (400, 1rem, 1.5): base del documento y bio (máximo 32ch, centrada, en hueso apagado).
- **Body-sm** (400, 0.875rem): título del último video (una línea con elipsis) y aviso flotante.
- **Label** (400, 0.8125rem): metadatos de cada link y pie, en hueso apagado; "En vivo" sube a 600 y va en lima.
- **Data** (monoespaciada, 0.8125rem, cifras tabulares): cronómetro del stream y duración del video.

### Named Rules
**La regla de la voz de marca.** Bricolage Grotesque solo en nombres: persona, secciones y links (y la inicial del avatar provisorio). Párrafos, metadatos, botones y avisos van en la fuente del sistema.

**La regla de las cifras quietas.** Todo número que cambia en pantalla (tiempo en vivo, duración) usa la monoespaciada con `tabular-nums` para que no tiemble el ancho.

### Compromiso de portación: alojamiento de la fuente
En el prototipo Bricolage Grotesque todavía se carga desde Google Fonts, con preconnect a `fonts.googleapis.com` y `fonts.gstatic.com`. Es el único punto abierto de la revisión final (7 de 8 correcciones resueltas) y la decisión del usuario es diferirlo a la portación a Astro: ahí se aloja localmente con el paquete `@fontsource-variable/bricolage-grotesque` (licencia OFL-1.1), sirviendo solo el subset latino en woff2, y se eliminan los preconnect a Google Fonts. Ninguna superficie nueva debe volver a cargar fuentes desde un CDN externo.

## Layout

Columna única centrada de 30rem de ancho máximo, con 1.25rem de margen lateral y 2rem al pie. De arriba abajo: barra superior (isotipo de Plektia a la izquierda, compartir a la derecha), identidad centrada (avatar, nombre, bio), la patchera con sus secciones y el pie "Hecho con Plektia".

Dentro de la patchera cada fila es una grilla de dos columnas: el **carril de jacks** (4.5rem; 5.5rem desde 48rem de ancho) y el texto (`minmax(0, 1fr)`). Los títulos de sección arrancan con sangría igual al carril, de modo que texto y títulos comparten un mismo borde izquierdo. Cada fila mide al menos 3.25rem y el jack se centra verticalmente sobre ese alto mínimo. Entre secciones hay 2.5rem; la patchera arranca 1.5rem debajo de la identidad.

Escala de espaciado en múltiplos de 0.25rem (1, 2, 3, 4, 5, 6, 8, 10). El ritmo más usado es 0.75rem (padding de filas, separación interna) y 2.5rem (entre secciones y antes del pie).

Todo blanco táctil mide al menos 44 × 44 px (botones de ícono, fila del último video, link del pie).

### Named Rules
**La regla del carril del hilo.** El hilo vive solo en el carril de jacks y su margen izquierdo. Su desvío hacia la derecha se calcula contra el borde del texto, con un respiro de 8 px más medio grosor del trazo: nunca cruza ni toca el texto, en ningún ancho de pantalla.

## Elevation & Depth

Plano. No hay sombras de elevación, ni capas flotantes con desenfoque, ni tarjetas. La profundidad se arma con tres recursos: filetes de 1 px (grafito bajo los títulos, grafito tenue entre filas, grafito punteado en la sub-fila del último video), un cambio tonal mínimo a la superficie en hover, y el apilamiento real del hilo, que pasa por debajo del jack para que se lo vea entrar por el anillo.

`box-shadow` aparece, pero solo como **anillo de trazo duro**, sin desenfoque ni desplazamiento: el doble anillo del avatar (3 px de fondo y luego 2 px de hueso) y el borde interior de 1.5 px grafito en el ojo del jack. Es parte del vocabulario de jacks, no elevación.

### Named Rules
**La regla del filete.** Para separar, un filete de 1 px; para agrupar, espacio. Nunca una caja con fondo o sombra alrededor de un link.

**La regla del anillo.** Si `box-shadow` aparece, es un anillo concéntrico de spread puro (`0 0 0 Npx`), nunca una sombra con desplazamiento o desenfoque.

## Shapes

Dos formas conviven. El **círculo** es la forma de la marca y de la patchera: jacks (18 px, aro de 2.5 px), avatar (88 px con doble anillo), el pulso del en vivo y los nodos del isotipo. El **rectángulo de esquinas apenas suavizadas** es la forma funcional: 6 px en botones de ícono, miniatura de video y aviso flotante; 4 px en el badge de duración y en el contorno de foco. No hay píldoras ni esquinas grandes.

El trazo es la otra forma recurrente: el hilo de 3.2 px con extremos redondeados, marcas diagonales de 1 px cada 4.2 px que lo hacen leer como cordón torcido, un nudo de lazo cerrado al inicio y la punta suelta al final. Los íconos son SVG de trazo 1.8 con extremos redondeados.

## Components

### Botón de ícono
Discreto y táctil.
- **Shape:** esquinas suaves (6 px), 44 × 44 px mínimo, ícono de 22 px.
- **Default:** sin fondo ni borde, ícono hueso.
- **Hover:** fondo superficie, transición de 160 ms.
- **Focus:** contorno hueso de 2 px a 4 px de distancia (regla global de foco).
- **Uso:** isotipo de Plektia (invitación a crear tu página) y compartir. Compartir abre la hoja nativa; si no existe, copia el link y muestra el aviso.

### Fila de link (puerto)
El componente central: jack en el carril, nombre y metadato a la derecha, flecha de salida al final.
- **Estructura:** grilla de carril + texto; dentro del texto, nombre (title) arriba y metadato (label, hueso apagado) abajo; flecha diagonal de 18 px en hueso apagado.
- **Separación:** filete grafito tenue debajo de cada fila; sin fondo, sin numeración.
- **Hover / focus:** el nombre se subraya (1 px, offset 3 px), la flecha pasa a hueso y se corre 2 px en diagonal, el jack escala a 1.15 y el tramo de hilo que llega a ese jack se tensa (se acerca a la recta).
- **En vivo:** el metadato lleva "En vivo" en lima 600, el cronómetro en monoespaciada lima y el título del stream.

### Jack
- **Reposo:** aro hueso de 2.5 px, ojo negro con borde interior grafito de 1.5 px.
- **En vivo:** aro y ojo lima; un anillo lima de 2 px late hacia afuera (de 0.6 a 1.7 de escala, 1800 ms, en loop). Con movimiento reducido el anillo queda quieto a media opacidad.

### Título de sección (banco)
- Headline en hueso, filete grafito de 1 px debajo, con sangría del carril. Lo escribe, ordena, renombra u oculta el usuario desde el panel.

### Último video (sub-fila plegable)
Colgada del link de YouTube, sin caja.
- **Plegada:** filete grafito punteado arriba; metadato ("Último video · hace 2 días") sobre el título en body-sm de una línea con elipsis; chevron a la derecha. Alto mínimo 44 px.
- **Hover:** el título se subraya.
- **Abierta:** el chevron gira 180°, el panel se despliega animando la fila de la grilla (320 ms) y muestra la miniatura 16:9 con esquinas de 6 px y el badge de duración abajo a la derecha. Cerrado, el panel es `inert`.

### Avatar
- Círculo de 88 px con doble anillo (fondo y hueso): es el jack más grande de la página. En el prototipo es una inicial provisoria; al portar va la foto real con texto alternativo.

### Aviso flotante (toast)
- Fondo hueso, texto negro, body-sm, esquinas de 6 px, centrado abajo. Entra subiendo 8 px con fundido de 320 ms y se va a los 2.4 s. Región `role="status"` con `aria-live="polite"`.

### Hilo (componente firma)
SVG absoluto sobre la patchera, sin eventos de puntero, que nunca mueve el layout.
- **Forma:** una curva Bézier por tramo entre jacks, con dos desvíos al azar que dan curvas en C o en S hacia cualquier lado, nunca rectas. La semilla del PRNG cambia en cada carga: la forma es distinta en cada visita.
- **Color:** hueso con trenzado negro; el tramo que llega a un jack en vivo se repinta en lima.
- **Enhebrado:** al cargar se revela de arriba hacia abajo en 1200 ms con curva exponencial, una sola vez. Se calcula después de que cargan las fuentes.
- **Tensado:** al enfocar o pasar sobre un link, su tramo baja a 20% de desvío con un acercamiento suave por cuadro.
- **Movimiento reducido o pestaña oculta:** el hilo aparece completo sin animación y el tensado es instantáneo.

## Do's and Don'ts

### Do:
- **Do** reservar la lima para el en vivo: jack, pulso, tramo de hilo, etiqueta y cronómetro.
- **Do** usar hueso para foco (contorno de 2 px, offset de 4 px) y selección (fondo hueso, texto negro).
- **Do** separar filas con filetes de 1 px y agrupar con espacio.
- **Do** mantener el hilo dentro del carril de jacks y recalcularlo en cada cambio de tamaño.
- **Do** respetar `prefers-reduced-motion`: sin transiciones, sin pulso animado, hilo completo y quieto.
- **Do** definir cada tema nuevo redefiniendo el set completo de tokens y verificar 7:1 de texto contra su fondo y su superficie.
- **Do** dar a cada blanco táctil al menos 44 × 44 px.
- **Do** usar la monoespaciada con cifras tabulares para todo número que cambia en pantalla.

### Don't:
- **Don't** usar la lima para foco, hover, selección, botones o decoración.
- **Don't** convertir los links en botones redondeados centrados, píldoras o tarjetas con fondo.
- **Don't** usar sombras con desenfoque o desplazamiento; `box-shadow` solo como anillo de spread puro.
- **Don't** dejar que el hilo cruce el texto ni que su animación mueva el layout.
- **Don't** numerar los links ni atenuar los que no están en vivo.
- **Don't** escribir colores literales en componentes; siempre tokens del tema.
- **Don't** usar grafito o grafito tenue para texto: son colores de trazo.
- **Don't** cargar fuentes desde un CDN externo en el producto portado.

## Estilos: familias y variantes

Desde [SPEC-styles](SPEC-styles.md), los cuatro "temas" del contrato de tokens pasaron a ser **familias** (Técnico, Cercano, Enérgico, Editorial) con **variantes** adentro: diez en total. `pages.theme` guarda la variante y es el valor de `data-theme`; la familia y lo que admite cada variante se deducen en `src/domain/theme.ts`. Cada variante tiene su propio motivo y su pieza firma; todas comparten la estructura, el contenido y las clases de los componentes, y redefinen sus marcadores (el jack pasa a ser punto, estación, LED, folio).

| Familia | Variante (`data-theme`) | Estado | Pieza firma | Señal en vivo |
|---|---|---|---|---|
| Técnico | Patchera (`tecnico`) | construida | Hilo trenzado entre jacks | Jack lima que late |
| Cercano | Punto (`punto`) | construida | Hileras de puntos de lana; links como retazos cosidos | El retazo teñido entero |
| Cercano | Lado A / B (`cassette`), Corcho (`corcho`) | próximamente | | |
| Enérgico | Subte (`subte`), Pedalera (`pedalera`), Bitmap (`bitmap`) | próximamente | | |
| Editorial | Lomo cosido (`lomo`), Manual (`manual`), Sumario (`sumario`) | próximamente | | |

Todo lo documentado arriba (Overview a Do's and Don'ts) es el sistema de Técnico y la base de todas las variantes. Cada variante escribe su CSS en `src/ui/styles/themes/<variante>.css`, acotado a `[data-theme="<variante>"]`, y se carga en línea solo en las páginas que la eligieron.

### Reglas comunes

**La regla de la misma página.** Ninguna variante cambia el orden, esconde contenido ni agrega texto propio: barra superior, avatar, nombre, `@handle`, bio, fila de íconos, destacados, secciones con sus links, último video plegable, en vivo y pie, siempre en ese orden. El avatar aparece siempre (foto o inicial) con la forma de la variante.

**La regla de los dos sets.** Cada variante define sus tokens completos en oscuro y en claro, con Automático por `prefers-color-scheme`, y cumple AAA en los dos (7:1 texto, 4.5:1 texto grande, contra su fondo y su superficie). `tests/unit/ui/tokens.test.ts` lo mide en Técnico y `tests/unit/ui/theme-tokens.test.ts` en cada variante con hoja propia, incluidos todos sus acentos.

**La regla de la señal propia.** Cada variante tiene una sola señal en vivo, exclusiva: no se reusa para foco ni para hover. La regla de la señal única de Técnico vale en cada variante con su propia señal.

**La regla de lo que admite.** El estilo propone y el dueño ajusta: cada variante declara qué acentos admite (cada uno con su tono AAA propio en claro y en oscuro), qué formas de link y qué tipografías de nombre, con una por defecto en cada eje. Si lo guardado no está admitido, la página usa la de por defecto sin tocar lo guardado, y el panel lo avisa.

**La regla del peso.** CSS en línea solo de la variante elegida; script solo si la pieza firma lo necesita; a lo sumo una fuente propia precargada, alojada localmente y sin CDN. El presupuesto de la página pública no cambia.

Además valen para todas: foco visible, 44 px táctiles, `prefers-reduced-motion` con la pieza firma quieta, y ninguna numeración de links salvo en Sumario. Las excepciones a una regla de Técnico son propias de cada variante, se documentan en su subsección y quedan acotadas a su `[data-theme]`.

### Grilla de estilos del panel

En Panel → Página, "Estilo" es una grilla por familia: el nombre de la familia en display 500 con su público en body-sm hueso apagado debajo, y las variantes en celdas de 9.5rem mínimo. Cada celda es una opción con borde grafito tenue de 1 px y esquinas de 6 px; la elegida pasa a borde hueso con un anillo interior de 1 px. Adentro va una **miniatura real**: el fondo, el acento y la señal en vivo de la variante en el modo de la página, el avatar de 28 px con aro de acento de 2 px y dos filas (la de arriba en vivo). Cada variante redefine la miniatura con su motivo (en Técnico, jacks unidos por un tramo de hilo). Las variantes no construidas quedan a 55% de opacidad, sin seleccionar, con el texto "Próximamente". El panel en sí conserva la estética de Técnico.

### Punto (familia Cercano)

**La página está tejida.** Cada sección arranca con una hilera de puntos de lana y cada link es un retazo de tela cosido con puntada visible. Lanas teñidas en color plano, sin textura fotográfica: lo cálido sale del oficio, no de esquinas blandas. No hay hilo ni carril de jacks: los retazos ocupan todo el ancho de la columna (`--jack-col: 0px`).

#### Colors

Tostado y crema en oscuro, avena y tinta en claro; la lana del acento cose todo. Los valores normativos están en el frontmatter (`punto-*`).

- **Tostado** (`punto-tostado`) / **Avena** (`punto-avena`): fondo de la página en oscuro y en claro. El tostado también es la tinta sobre el retazo teñido y el trenzado en oscuro.
- **Crema** (`punto-crema`) / **Tinta** (`punto-tinta`): texto principal, foco y fondo de la selección.
- **Crema apagada** (`punto-crema-apagada`) / **Tinta apagada** (`punto-tinta-apagada`): bio y metadatos.
- **Retazo** (`punto-retazo`) / **Retazo claro** (`punto-retazo-claro`): la tela de cada link, destacado y botón de la fila de íconos. En claro el retazo es más claro que el fondo; en oscuro, más claro que el tostado.
- **Costura** (`punto-costura`, `punto-costura-claro`): el borde de 1 px de cada retazo. **Costura tenue** (`punto-costura-tenue`, `punto-costura-tenue-claro`): filetes secundarios.
- **Teñido en vivo** (`punto-tenido-en-vivo`, `punto-tenido-en-vivo-claro`): el fondo del retazo en vivo, con **tinta en vivo** (`punto-tostado` en oscuro, `punto-tinta-en-vivo-claro` en claro) para el texto y la costura encima.

**Acentos admitidos** (seis de los ocho; por defecto, coral). El acento tiñe la costura, la hilera, el doble aro del avatar y la doble costura del destacado.

| Acento | Lana | Oscuro | Claro |
|---|---|---|---|
| `coral` (por defecto) | terracota | `#ffb294` | `#7a2c12` |
| `ambar` | mostaza | `#e9b949` | `#5c3d00` |
| `turquesa` | salvia | `#acd2b4` | `#264d31` |
| `lavanda` | lavanda | `#d0c0f0` | `#4a386e` |
| `rosa` | rosa | `#f9b9c8` | `#742a41` |
| `arena` | arena | `#dcc39d` | `#523c22` |

`hueso` y `cielo` no se admiten en Punto.

**Lanas alternadas.** Las hileras alternan tres lanas por sección, en ciclo: la 1.ª, 4.ª, … en el acento elegido; la 2.ª, 5.ª, … en mostaza (`punto-mostaza` / `punto-mostaza-claro`); la 3.ª, 6.ª, … en salvia (`punto-salvia` / `punto-salvia-claro`). Son decorativas y piden al menos 3:1 contra el fondo.

**La regla del teñido.** En Punto la señal en vivo no es un color sino un estado de la tela: el retazo entero teñido, con el texto y la costura en la tinta. Ningún otro retazo lleva fondo teñido. El teñido es índigo (`#b3cdff` en oscuro, `#1e3a78` en claro): un tono que ninguno de los seis acentos de Punto usa, así la señal se distingue por color y no solo por el relleno.

#### Typography

**Display Font:** Fraunces variable (subset latino, eje `SOFT`, alojada localmente), por defecto en los nombres. Admite también **Nunito** y **Bricolage Grotesque**; Space Mono no se admite.
**Body Font:** la del sistema, igual que Técnico.

- Persona, títulos de sección, nombre de cada link y nombre de cada destacado llevan `font-variation-settings: "SOFT" 100`: la Fraunces de terminaciones blandas, que lee artesanal sin perder la serif.
- El nombre del link sube a 600 (en Técnico es 500): el retazo con fondo pide un nombre más firme.
- El cronómetro en vivo usa la fuente del cuerpo con `tabular-nums`, no la monoespaciada: las cifras siguen quietas, sin cortar la voz cálida del retazo.

#### Shapes

- **Retazo:** borde de 1 px en costura, fondo retazo, esquinas de 12 px (`--radius-md` sube a 12 px en Punto) y 0.5rem de separación entre retazos. Adentro, la **costura**: un trazo punteado de 1.5 px en el acento, metido 5 px adentro del borde y con el mismo radio (4 px adentro en los botones de íconos).
- **Pastillas:** con la forma `pills`, el radio pasa a media fila (1.625rem) y el padding lateral a 1.25rem. Punto admite solo `cards` (por defecto) y `pills`: nunca filas sueltas.
- **Avatar:** doble aro, uno sólido y otro cosido. El sólido es un anillo de spread puro (3 px de fondo y 2 px de acento); el cosido, un contorno punteado de 1.5 px en el acento a 8 px de distancia.
- **Hilera:** una fila de V de lana de 10 px de alto (trazo de 2 px, extremos redondeados), repetida con paso ajustado para no cortar ninguna V a la mitad, encima de cada título de sección. Reemplaza al filete grafito.

#### Components

- **Retazo (fila de link):** el jack se oculta y el texto ocupa toda la fila. Hover y foco cierran la puntada: la costura pasa de punteada a continua. Es el único uso del trazo sólido de costura.
- **En vivo:** el retazo se tiñe entero (fondo y borde en el teñido en vivo); metadato, etiqueta "En vivo", cronómetro, ícono, flecha, costura y el filete del último video pasan a la tinta en vivo.
- **Destacado:** doble costura, dos trazos punteados de acento (a 5 px y a 10 px del borde, el interior con radio de 6 px). No es el trazo sólido del hover. El texto se corre para no pisarla (1rem arriba y abajo, 1.25rem a los lados).
- **Fila de íconos y tarjetas destacadas:** también son retazos, con borde, fondo y costura.
- **Miniatura del panel:** una hilera de V de 6 px arriba, un retazo cosido (esquinas de 6 px, costura de 1 px a 2 px adentro) y uno teñido en vivo; sin jack ni tramo de hilo.

#### Firma: la hilera que se teje

Al cargar, la primera hilera de la página se teje de izquierda a derecha punto por punto: se revela en 1100 ms en 44 pasos discretos, una sola vez. Las demás hileras están quietas desde el principio. Con `prefers-reduced-motion` la primera hilera también aparece completa y quieta.

#### Excepciones a Técnico, acotadas a `[data-theme="punto"]`

Estas excepciones son propias de Punto y no se heredan a otras variantes ni a Técnico:

- **Retazos con fondo y caja** en vez de filas sin caja separadas por filete (excepción a la regla del filete y al "Don't" de tarjetas con fondo).
- **Esquinas de 12 px y pastillas** en vez de esquinas apenas suavizadas (excepción a "no hay píldoras ni esquinas grandes").
- **Sin hilo ni carril de jacks.**
- **Contorno punteado decorativo** en el avatar y en las costuras, que no es foco: el foco sigue siendo el contorno sólido de 2 px en `--color-focus`.
- **Cronómetro en la fuente del cuerpo** con cifras tabulares, en vez de la monoespaciada.

#### Do's and Don'ts

##### Do:
- **Do** coser cada link como retazo: borde de 1 px, fondo retazo y costura punteada de 1.5 px metida 5 px adentro.
- **Do** cerrar la puntada (punteada a continua) para hover y foco, y reservar la doble costura para el destacado.
- **Do** teñir el retazo entero para el en vivo, con texto y costura en la tinta en vivo.
- **Do** abrir cada sección con su hilera de V, alternando acento, mostaza y salvia.
- **Do** tejer solo la primera hilera al cargar, y dejarla quieta con movimiento reducido.
- **Do** usar Fraunces con `SOFT` 100 en los nombres cuando es la tipografía elegida.

##### Don't:
- **Don't** volver a filas sueltas, jacks o hilo dentro de Punto.
- **Don't** usar el trazo sólido de costura fuera del hover y el foco.
- **Don't** teñir de fondo ningún retazo que no esté en vivo.
- **Don't** dar textura fotográfica a las lanas: color plano.
- **Don't** sacar las excepciones de Punto de `[data-theme="punto"]`.
