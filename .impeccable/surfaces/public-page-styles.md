---
version: 1
slug: "public-page-styles"
primary_target: "src/ui/styles/themes"
related_targets: ["src/ui/components/ProfilePage.astro", "src/domain/theme.ts"]
---

# Estilos de la página pública (variantes de tema)

## Scope and mode

Operate. Variantes elegibles por el dueño para `/{handle}` ([SPEC-styles](../../SPEC-styles.md)). Misma estructura y contenido que la patchera; cada variante trae su mundo visual, su pieza firma y su señal en vivo. Claro y oscuro, AAA, avatar siempre.

## Audience, job, constraints

- Visitante desde la bio de una red social, en el celular: encontrar el link o ver si está en vivo en uno o dos toques.
- Dueño que elige un estilo que lo represente (Cercano: creadores personales; Enérgico: streamers; Editorial: quienes escriben).
- Una fuente propia precargada como máximo, CSS solo de la variante elegida, sin CDN.

## Direction contract — Punto (familia Cercano)

THESIS: La página está tejida: cada sección arranca con una hilera de puntos de lana y cada link es un retazo cosido con puntada visible. Rechaza la columna de botones redondeados genéricos: lo cálido sale del oficio, no de esquinas blandas.

OWN-WORLD: Lanas teñidas en color plano, sin textura fotográfica: avena (#efe3cc) y tostado oscuro (#1f1813) como fondos, terracota, mostaza y salvia como acentos; puntada en V de 2 px; retazos con borde de costura punteada; Fraunces suave para nombres.

STORY: El visitante ve a la persona, nota el retazo teñido si está en vivo, recorre las franjas y toca el retazo que busca.

FIRST VIEWPORT: Barra superior; avatar redondo con doble aro de acento, nombre en Fraunces, bio; hilera de puntos de acento; título de la primera sección y sus retazos, el en vivo arriba teñido entero.

FORM: Punto, candidata 5 de mi lista (asignada por el dado), seed 6c013a65. Firma: la hilera de puntos se "teje" de izquierda a derecha una sola vez al cargar (quieta con movimiento reducido).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Direction contract — Subte (familia Enérgico)

THESIS: La página es un plano de subte de noche: cada sección es una línea de color con su número y cada link, una estación sobre esa línea. Rechaza el "neón gamer" con gradientes: la energía sale del color pleno de las líneas y de la estación que destella.

OWN-WORLD: Azul esmalte de medianoche (#0d1b3d) en oscuro y papel de plano (#f4f2ec) en claro; líneas coral, cielo, turquesa, lavanda y rosa a 7 px con esquinas redondas; estaciones blancas con aro grueso del color de su línea; ámbar reservado al en vivo.

STORY: El visitante ve a la persona, encuentra la estación que destella si está en vivo, recorre línea por línea y toca la estación que busca.

FIRST VIEWPORT: Barra superior; avatar con aro grueso de combinación; nombre y bio; la primera línea con su chapa "L1", su barra vertical y las estaciones, la de en vivo arriba en ámbar con su destello.

FORM: Subte, desafiante competitivo del seed 45e9120b elegido por el usuario (coincide con la variante en reserva de DESIGN.md). Firma: la primera línea se traza de arriba abajo al cargar y la estación en vivo destella; quietas con movimiento reducido.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Direction contract — Lomo cosido (familia Editorial)

THESIS: La página es un libro encuadernado a mano: cada sección es un cuadernillo con su capítulo en versalitas y numeración romana, y la costura del lomo los une; cada link es una entrada de índice. Rechaza la "tarjeta de blog" con sombra: lo editorial sale de la tipografía y del oficio de encuadernación.

OWN-WORLD: Papel crudo (#f3efe4) y tinta (#1f1b16) en claro; tinta clara sobre negro de imprenta (#17140f) en oscuro; el lomo como filete fino con puntadas de hilo en el color de la tela (tinta azul, verde botella, violeta u ocre); serif de lectura (Fraunces) en nombres, bio en itálica, filetes punteados entre entradas; rojo reservado a la cinta marcapáginas.

STORY: El visitante ve el ex libris (avatar) y el nombre, encuentra la cinta roja si está en vivo, recorre los capítulos y toca la entrada que busca.

FIRST VIEWPORT: Barra superior; avatar con doble filete de ex libris; nombre en Fraunces y bio en itálica; el capítulo "I · Redes" en versalitas con filete, el lomo con sus puntadas a la izquierda y la entrada en vivo con la cinta roja colgando.

FORM: Lomo cosido, candidata 7 de mi lista (asignada por el dado), seed 18f8976e. Firma: las puntadas del primer cuadernillo se cosen una por una al cargar; quietas con movimiento reducido.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Direction contract — Lado A / B (familia Cercano)

THESIS: La página es la carátula de un cassette compilado a mano: cada sección es un lado ("Lado A", "Lado B"…) escrito con birome, y cada link es un tema de la lista sobre el papel rayado. Rechaza la nostalgia de stickers: lo cercano sale de la mano que escribe la lista, no de efectos retro.

OWN-WORLD: Carátula de papel (#fbfbf7) con tinta de birome azul (#1d2c6b) y renglones celestes; en oscuro, el cuerpo negro del cassette (#16171b) con tinta clara. Una franja de marca arriba en el color del acento (azul, dorado Maxell, verde, violeta o la tinta). Títulos de lado en Kalam 700 (manuscrita firme); temas en Nunito. Rojo reservado a los carretes del en vivo.

STORY: El visitante ve la carátula con el nombre, nota los carretes rojos si está en vivo, recorre los lados y toca el tema que busca.

FIRST VIEWPORT: Franja de marca arriba; avatar con aro de tinta; nombre y bio; "Lado A · Redes" escrito a mano con su subrayado; los temas sobre renglones, el en vivo con sus dos carretes rojos.

FORM: Lado A / B, desafiante competitivo del seed 6c013a65 elegido por el usuario. Firma: el título del primer lado se escribe de izquierda a derecha al cargar; quieto con movimiento reducido.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Direction contract — Corcho (familia Cercano)

THESIS: La página es un tablero de corcho: cada link es una nota de papel clavada con una chinche, y un hilo rojo tenso une las chinches de cada sección, como el tablero de alguien que arma su mapa de cosas. Rechaza el "moodboard" de fotos y washi tape por todos lados: lo cercano sale del papel clavado a mano y del hilo, no de la decoración.

OWN-WORLD: Corcho claro (#e6cba3) con notas de papel crema (#fffaee) y tinta marrón casi negra (#24180e); de noche, corcho oscuro (#241a12) con notas de papel en penumbra (#33291f) y tinta clara. Chinches en el color del acento (azul, verde, violeta, rosa o la tinta); el hilo es rojo (#a11f17 / #e0473b) y no es la señal en vivo. Títulos de sección sobre una tira de cinta de papel. Nunito por defecto. Amarillo reservado al en vivo: la nota amarilla con la chinche roja.

STORY: El visitante ve la polaroid (avatar) y el nombre, encuentra la nota amarilla si está en vivo, sigue el hilo por cada sección y toca la nota que busca.

FIRST VIEWPORT: Barra superior; avatar en marco de polaroid apenas inclinado; nombre y bio sobre el corcho; "Redes" en su tira de cinta; las notas clavadas, levemente torcidas en alternancia, con sus chinches unidas por el hilo rojo; la nota en vivo, amarilla con chinche roja.

FORM: Corcho, propuesta aprobada por el usuario en la tanda de nueve mockups. Firma: las chinches del primer grupo se clavan una por una al cargar (bajan de escala); quietas con movimiento reducido. El papel se inclina, el texto no: la inclinación vive en un pseudo-elemento detrás del texto.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Direction contract — Pedalera (familia Enérgico)

THESIS: La página es una pedalera armada en el piso del escenario: cada link es un pedal con su LED y su pisador, y un cable de patch sale del costado de un pedal y entra en el siguiente. Rechaza el "gamer RGB" de brillos y gradientes: la energía sale del hardware —el gabinete, el pisador, el LED que se prende— no de neones.

OWN-WORLD: Tablero negro de velcro (#121316) con gabinetes de aluminio pintado oscuro (#24262b) y tinta clara (#eef0f3); de día, tablero gris claro (#e8e6e1) con gabinetes crema (#fbfaf7) y tinta casi negra. Cables de patch grises (#6d717a / #2a2c30) en un carril angosto a la izquierda. El acento es el aro del pisador y del destacado (verde por defecto, ámbar, azul, violeta o la tinta). Títulos de sección como etiquetas de rotuladora (Dymo): tinta invertida, en mayúsculas. Bricolage por defecto. Rojo reservado al LED encendido del en vivo.

STORY: El visitante ve la perilla (avatar) y el nombre, encuentra el pedal con el LED rojo prendido si está en vivo, recorre la cadena de pedales siguiendo los cables y pisa el que busca.

FIRST VIEWPORT: Barra superior; avatar como perilla con el borde moleteado; nombre y bio; la etiqueta "REDES"; los pedales encadenados por cables en el carril izquierdo, cada uno con su LED apagado y el pisador redondo a la derecha; el pedal en vivo con el LED rojo encendido.

FORM: Pedalera, propuesta aprobada por el usuario en la tanda de nueve mockups. Firma: los cables del primer grupo se enchufan uno por uno al cargar (se revelan de arriba hacia abajo); quietos con movimiento reducido. Sin script: el cable es CSS.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Direction contract — Bitmap (familia Enérgico)

THESIS: La página es un afiche de pantalla de 8 bits: el nombre y cada sección van en letra pixelada a escala póster, y debajo los links son listas finas, de una línea de 1 px. Rechaza el "retro gamer" de scanlines, CRT y neón: la energía sale del contraste entre la letra gorda pixelada y la lista finita, no de efectos.

OWN-WORLD: Negro de pantalla (#0e0f13) con tinta blanca (#f2f3f7); de día, papel (#f3f3ee) con tinta casi negra. Pixelify Sans 700 (alojada, solo en Bitmap) para el nombre, los títulos de sección y la inicial del avatar; los links en la fuente de nombre elegida, finos. El acento es una barra de píxeles bajo cada título y el cursor de bloque del link (azul por defecto, verde agua, ámbar, violeta o la tinta). Esquinas en escalera de píxeles, nunca redondeadas. Rosa reservado al en vivo.

STORY: El visitante ve el avatar en su marco de píxeles y el nombre gigante, ve la etiqueta rosa "EN VIVO" que parpadea si está transmitiendo, recorre los títulos pixelados y toca el link de la lista.

FIRST VIEWPORT: Barra superior; avatar cuadrado con esquinas en escalera dentro de un marco de píxeles en el acento; el nombre en Pixelify a escala póster; bio; "Redes" pixelado con su barra de píxeles; la lista fina de links; el en vivo con su etiqueta rosa invertida.

FORM: Bitmap, propuesta aprobada por el usuario en la tanda de nueve mockups (se mostraron en el chat del 2026-10-30 y no quedaron en el repo; la decisión está en SPEC-styles.md, con el avatar obligatorio pedido por el usuario). Firma: la etiqueta "EN VIVO" parpadea cuatro veces en pasos duros y queda fija (nunca más de 5 s, WCAG 2.2.2); quieta con movimiento reducido. Al pasar por un link aparece un cursor de bloque delante del nombre.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
