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
rounded:
  sm: "4px"
  md: "6px"
  full: "50%"
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
