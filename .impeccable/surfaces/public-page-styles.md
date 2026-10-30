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
