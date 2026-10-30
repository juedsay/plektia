# Spec: `styles`

> Módulo del [mapa de capacidades](CAPABILITY-MAP.md). Extiende [`appearance`](SPEC-appearance.md),
> [`public-page`](SPEC-public-page.md) y [`admin-panel`](SPEC-admin-panel.md), sobre el contrato de
> tokens de [DESIGN.md](DESIGN.md). Hereda las convenciones de [`platform`](SPEC-platform.md).
> Estado: **aprobado (2026-10-30)**.

## Objetivo

Que el dueño elija un estilo para su página que lo represente, entre cuatro familias y diez
variantes, sin que la página deje de ser rápida, accesible y fácil de recorrer. Cada variante tiene
su propio mundo visual y su pieza firma. Comparten la estructura y el contenido.

Decisiones del 2026-10-30 (`shape` con impeccable, maquetas revisadas con el usuario):

- **Cada estilo tiene su propio motivo** (no es una piel nueva de la patchera), pensado para un
  perfil de persona.
- **El estilo propone y el dueño ajusta:** cada variante trae sus valores de acento, forma y
  tipografía, y los ajustes de la Entrega 6b se mueven dentro de lo que esa variante admite.
- **Las nueve propuestas, en dos tandas**, una variante por PR.
- **El avatar en todas:** la foto si el dueño la tiene, y la inicial si no.

## Familias y variantes

| Familia | Para quién | Variante | Pieza firma | Señal en vivo |
|---|---|---|---|---|
| Técnico | (la de hoy) | **Patchera** `tecnico` | Hilo trenzado entre jacks | Jack lima que late |
| Cercano | Creadores personales, artistas, comunidades | **Punto** `punto` | Hileras de puntos de lana; links como retazos con costura | El retazo teñido entero |
| | | **Lado A / B** `cassette` | Carátula de cassette escrita a mano; secciones como lados | Los carretes en rojo |
| | | **Corcho** `corcho` | Notas clavadas con chinches y un hilo rojo que las une | La nota amarilla con chinche roja |
| Enérgico | Streamers y gamers | **Subte** `subte` | Secciones como líneas de color; links como estaciones | La estación que destella |
| | | **Pedalera** `pedalera` | Links como pedales con LED; un cable de patch los une | El LED encendido |
| | | **Bitmap** `bitmap` | Títulos pixelados a escala póster sobre listas finas | La etiqueta que parpadea |
| Editorial | Quienes escriben: periodistas, newsletters, academia | **Lomo cosido** `lomo` | Libro encuadernado; costura del lomo entre cuadernillos | La cinta marcapáginas |
| | | **Manual** `manual` | Separadores de color y pestañas en el borde | El sello rojo |
| | | **Sumario** `sumario` | Índice de revista con folios grandes y versalitas | El folio en rojo |

**Primera tanda:** Punto, Subte y Lomo cosido. **Segunda tanda:** Lado A/B, Corcho, Pedalera, Bitmap,
Manual y Sumario.

## Reglas para todas las variantes

1. **Misma estructura y contenido:** barra superior, avatar, nombre, `@handle`, bio, fila de íconos,
   destacados arriba, secciones con sus links, último video plegable, en vivo y pie. Ninguna variante
   cambia el orden, esconde contenido ni agrega texto propio.
2. **El avatar siempre:** la foto si existe, y la inicial si no, con la forma de esa variante (por
   ejemplo, un marco de polaroid en Corcho o un píxel en Bitmap).
3. **Claro y oscuro** con Automático. Cada variante define sus dos sets completos de tokens.
4. **AAA en la página pública:** texto 7:1 y texto grande 4.5:1 contra su fondo y su superficie, en
   los dos modos. Lo mide `tests/unit/ui/tokens.test.ts`, extendido a todas las variantes.
5. **Una sola señal en vivo**, exclusiva de esa variante (no se reusa para foco ni hover).
6. **Foco visible, 44 px táctiles y `prefers-reduced-motion`:** sin pulso ni parpadeo, y la pieza
   firma quieta.
7. **Liviana:**
   - CSS solo de la variante elegida, en un archivo propio con nombre por contenido y caché larga
     (Técnico sigue en línea);
   - un script solo si la pieza firma lo necesita (hilo o cable);
   - a lo sumo una fuente propia precargada, auditada y sin CDN;
   - el presupuesto de la página pública no cambia.
8. **Los ajustes de la 6b** dentro de lo que admite la variante. Cada variante declara:
   - sus **acentos**: cuáles de los 8 admite y su tono propio en claro y en oscuro, todos AAA, más
     uno por defecto;
   - las **formas** de link que admite y la de por defecto;
   - las **tipografías** de nombre que admite y la de por defecto.

   Si el dueño cambia de variante y su elección no está admitida, la página usa la de por defecto
   de esa variante sin tocar lo guardado, y el panel lo avisa.
9. **Marcas y números:** solo Sumario numera los links (los folios son su lenguaje) y solo Lado A/B
   escribe a mano (y solo en títulos). El resto de las reglas de DESIGN.md siguen valiendo.
10. **Rótulo de sección:** las variantes que numeran secciones ("Lado A", "L1", "I") usan el rótulo
    que escribe el dueño en el panel si lo hay (una línea segura de hasta 16 caracteres, `null` es
    el automático). El campo solo aparece si la variante guardada numera (`sectionMark`).

## Datos

- `public.profile_theme` suma los valores `punto`, `cassette`, `corcho`, `subte`, `pedalera`,
  `bitmap`, `lomo`, `manual` y `sumario`. `pages.theme` sigue siendo la variante, así `data-theme` y
  la vista pública no cambian de forma.
- La familia se deduce en el dominio (`src/domain/theme.ts`), igual que lo que admite cada variante:
  acentos, formas y tipografías. La base solo valida que el valor exista.
- Una variante se habilita cuando su PR la construye: el dominio la marca como disponible, y hasta
  entonces el panel la muestra como "Próximamente" y el parser la rechaza.
- Por MCP no se cambia, igual que hoy.

## Panel

- En Panel → Página, "Estilo" pasa a ser una grilla por familia. Cada variante tiene una miniatura
  real con el nombre y el avatar del dueño, en el modo elegido, y su descripción corta.
- Al elegir una variante, la vista previa del inicio la muestra. Los ajustes (acento, forma y
  tipografía) muestran solo lo que admite, y avisan si algo guardado no aplica.

## Construcción por variante

Cada PR de variante incluye:

- **Tokens claros y oscuros** y la verificación AAA.
- **CSS de la variante:** los componentes compartidos tienen las mismas clases, y la variante
  redefine sus marcadores (el jack pasa a ser punto, estación, LED, folio, etc.).
- **La pieza firma**, con su movimiento y su versión quieta.
- **Lo que admite de la 6b**, con sus acentos AAA.
- **Pruebas:**
  - E2E: elegirla en el panel la aplica en la página pública, con axe AAA en claro y en oscuro;
  - revisión visual a 390 px y en escritorio;
  - el detector de impeccable y la revisión de terminación.
- **DESIGN.md** con su sección.

La primera variante (Punto) también trae lo común:
- el valor nuevo del enum y `src/domain/theme.ts`;
- la grilla de estilos del panel;
- las clases compartidas que necesitan las demás.

## Fuera de alcance

- Colores libres, CSS propio, imágenes o videos de fondo.
- Cambiar la estructura o el orden del contenido según la variante.
- Variantes del panel (el panel sigue con la estética de Técnico, en claro y oscuro).

## Preguntas abiertas

1. Tipografías nuevas por variante (por ejemplo, una manuscrita para Lado A/B o una pixelada para
   Bitmap). Se audita cada paquete en el PR de su variante.
