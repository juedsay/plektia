# Spec: `appearance`

> Módulo del [mapa de capacidades](CAPABILITY-MAP.md). Extiende
> [`public-page`](SPEC-public-page.md), [`pages`](SPEC-pages.md) y
> [`admin-panel`](SPEC-admin-panel.md), sobre el contrato de tokens de
> [DESIGN.md](DESIGN.md). Hereda las convenciones de [`platform`](SPEC-platform.md).
> Estado: **aprobado (2026-10-29)**.

## Objetivo

Que cada dueño haga suya su página sin romperla: modo claro u oscuro, y ajustes de estilo
elegidos de opciones curadas que siempre cumplen WCAG 2.2 AAA y la CSP estricta. Que el panel
también tenga modo claro.

Decisiones del 2026-10-29:

- El dueño elige el modo de su página: **Oscuro, Claro o Automático** (sigue al dispositivo de
  cada visitante).
- El panel: **Automático por defecto**, con la opción de fijar Claro u Oscuro, guardada en la cuenta.
- **Estilo y modo son independientes:** cada uno de los 4 estilos (técnico, cercano, enérgico,
  editorial) tiene versión clara y oscura.
- Personalización con **opciones curadas** (sin colores libres, CSS propio ni imágenes de fondo):
  acento, forma de los links, tipografía de los nombres, fila de íconos de redes y link destacado.
- Entregas: **6a** (modo claro/oscuro en página y panel, sobre "técnico"), **6b** (los ajustes),
  y los otros 3 estilos después.

## Entrega 6a · Modo claro y oscuro

### Historias y criterios de aceptación

1. **Elegir el modo de mi página.** En Panel → Página, junto al estilo, elijo **Automático**,
   **Oscuro** o **Claro**. La vista previa lo muestra al instante y la página pública también,
   sin esperar la caché.
2. **Automático respeta al visitante.** Con Automático, quien tiene el celular en modo claro ve la
   página clara, y quien lo tiene en oscuro la ve oscura. Lo resuelve CSS
   (`prefers-color-scheme`): sin JavaScript, sin cookies y sin pedidos extra. La barra del
   navegador (`theme-color`) acompaña.
3. **Todas empiezan en Automático.** Las páginas que ya existen y las nuevas quedan en
   **Automático** (decisión del 2026-10-29): desde el deploy, quien tenga el celular en claro ve la
   página clara. El dueño puede fijar Oscuro si prefiere el aspecto de hoy.
4. **El panel en claro.** El panel sigue el sistema por defecto. Con el botón "Apariencia" (arriba
   en el celular y abajo de la columna lateral en escritorio, junto a "Cerrar sesión") elijo
   Automático, Claro u Oscuro. La elección me sigue en cualquier dispositivo y vuelvo a la misma
   pantalla. Es un menú `<details>` que funciona sin JavaScript y envía un POST a
   `/admin/apariencia`, que solo vuelve a pantallas del panel.
5. **Accesible en los dos modos.** Toda combinación de estilo y modo cumple AAA en la página pública
   (7:1 en texto y 4.5:1 en texto grande, contra el fondo y la superficie), y el panel cumple AA.
   Foco visible y `forced-colors` siguen funcionando.

### Diseño

- **Tokens:** `[data-theme="tecnico"]` es el oscuro. El claro redefine el mismo set de colores
  (`--color-*`) en `[data-theme="tecnico"][data-mode="light"]`, y
  `[data-mode="auto"]` aplica los mismos valores dentro de `@media (prefers-color-scheme: light)`.
  También cambian `color-scheme` y las dos sombras de fondo de diálogos, que hoy son literales.
- **Paleta clara de "técnico"** (medida con el cálculo de WCAG):

  | Token | Claro | Contra el fondo | Contra la superficie |
  |---|---|---|---|
  | `--color-bg` | `#f5f4ef` (papel) | — | — |
  | `--color-surface` | `#eceae3` | — | — |
  | `--color-fg` | `#16171a` | 16.3:1 | 14.9:1 |
  | `--color-fg-muted` | `#43464d` | 8.6:1 | 7.9:1 |
  | `--color-live` | `#2e5200` (verde musgo) | 8.2:1 | 7.5:1 |
  | `--color-line` / `--color-line-soft` | `#b9bab4` / `#dcdbd4` | trazos, nunca texto | — |

  La lima no alcanza en claro (la regla de DESIGN.md): la señal en vivo pasa a verde musgo, que
  sigue siendo exclusiva del en vivo. Foco y selección usan el texto (`--color-fg`), como en oscuro.
- **`theme-color`:** dos `<meta name="theme-color">` con `media="(prefers-color-scheme: …)"` en
  Automático; uno solo con el color del modo fijo.
- **Hilo:** ya lee `var(--color-thread)` y `var(--color-live)`, así que cambia con el modo sin tocar
  el script.

### Datos

- `pages.color_mode`: enum `public.color_mode` (`auto`, `dark`, `light`), `not null default 'auto'`,
  también para las filas existentes. Lo escribe el dueño
  desde el panel (mismo grant por columna y RLS que `theme`). Por MCP no se cambia, igual que el tema.
- `public_page_v` expone `color_mode`; la página pública lo pone en `data-mode`.
- `account_preferences.panel_mode`: el mismo enum, `default 'auto'`, en una tabla propia
  (`profiles` la puede leer el público y esta preferencia es solo del dueño). La lee y la cambia solo
  el dueño, desde el panel (sin `client_id`).

### Pruebas

- **pgTAP:** valores válidos, el default `auto`, y que
  solo el dueño y desde el panel cambie el modo de su página y del panel.
- **Unit:** el parser de la configuración de página con `colorMode` y la elección del panel.
- **E2E:**
  - cambiar el modo en el panel cambia `data-mode` en la página pública;
  - con Automático y `colorScheme: light` en Playwright, el fondo es el claro, y con `dark`, el
    oscuro;
  - axe AA en el panel claro;
  - AAA de contraste medido sobre la página en los dos modos.
- **Revisión visual** de la página y del panel en los dos modos, a 390 px y en escritorio.

## Entrega 6b · Ajustes de estilo (resumen; se detalla antes de empezarla)

| Ajuste | Opciones | Notas |
|---|---|---|
| **Color de acento** | 8 a 10 por estilo, cada uno con su tono claro y oscuro validado AAA | Filetes de sección, hilo y detalles. **No** el en vivo, que sigue con su señal única |
| **Forma de los links** | Filas (actual), tarjetas o pastillas; esquinas rectas o redondeadas | Variantes de componente con tokens; el objetivo táctil de 44 px se mantiene |
| **Tipografía de los nombres** | 3 o 4 pares curados servidos desde el sitio | Se precarga solo la fuente que usa la página; presupuesto de peso por página |
| **Fila de íconos de redes** | Links marcados como "red", mostrados como íconos bajo la bio | Usa los íconos que ya tiene el proyecto; cada ícono con nombre accesible |
| **Link destacado** | Un link resaltado arriba de todo | Uno por página |

Todo se guarda en columnas con valores enumerados (nunca CSS ni colores libres), se aplica con
atributos `data-*` y clases, y se ve en la vista previa en vivo del panel.

## Fuera de alcance

- Colores libres, CSS propio, imágenes o videos de fondo.
- Un interruptor de modo para el visitante en la página pública.
- Los estilos cercano, enérgico y editorial (entrega propia sobre el mismo contrato).

## Preguntas abiertas

1. Nombre visible de los modos en el panel: "Automático", "Oscuro" y "Claro" (propuesta).
