# Brief de marca

## Decisión final (2026-10-09)

- **Nombre:** Plektia (del griego *plektós*, "tejido, entrelazado"). `plektia.com` y `plektia.app` libres al 2026-10-09 (sin comprar).
- **Isotipo:** dirección "nodos y red": una "P" de trazo fino con tres nodos sobre el asta y un nodo de acento en la panza (la señal de en vivo). Archivos en [`plektia/`](plektia/).
- **Logotipo:** `plektia` en minúsculas, Bricolage Grotesque 500.
- **Paleta A:**

| Rol | Color |
|---|---|
| Fondo principal | Negro `#121315` |
| Texto y trazos | Hueso `#F2F2EE` |
| Acento / en vivo | Lima `#C6F432` (solo sobre fondo oscuro: contraste ~15:1) |
| Superficie secundaria | Grafito `#3A3D42` |

- **Restricción conocida:** la lima casi no contrasta sobre fondos claros. En la versión clara el nodo de acento pasa a negro. Al armar los tokens se evalúa una lima oscura para fondo claro.
- **Marcas registradas (búsqueda en TMview, 2026-10-09):** no hay ninguna marca "Plektia" idéntica. Parecidas en clases de software (9, 35, 42):

| Marca | Oficina | Estado | Clases | Riesgo |
|---|---|---|---|---|
| PLEKTRA | Suiza (IGE) | Registrada (2012) | 9, 35, 42 | Medio: una letra de diferencia y mismas clases, pero solo vale en Suiza |
| ALEKTIA | EUIPO | Registrada (2025) | 9, 35, 37, 38, 42 | Bajo-medio: rima, pero empieza distinto |
| ELEKTIA | INPI Argentina | Registrada (2025) | 9, 35, 37 | Bajo-medio: rima, pero empieza distinto |

  El resto (PLENTIA, PLESTIA, ΠΛΕΚΤΑ…) son de otros rubros. TMview no tiene valor legal: antes de registrar, consultar a un agente de marcas.
- **Si se registra:** INPI Argentina, clases 9 (software) y 42 (SaaS); evaluar la 35.

---

# Historial de exploración

## Decisiones

- **Personalidad del producto** (logo, panel, landing): cercana y relajada.
- **Qué transmite:** conexión, todo en un lugar, control con IA.
- **Público:** cualquiera (futuro multiusuario).
- **Nombre:** inventado y corto. Lista corta: **Hilvanu**, **Vinkolo**, **Bonduu**
  (`.com` libre al 2026-10-09; sin uso visible en la web; falta revisar marcas registradas).
  Descartados por estar en uso: Vincu, Vinkla, Plura, Unio.
- **Temas de la página pública:** 4 elegibles por el usuario (técnico, cercano,
  enérgico, editorial). La v1 sale con 1 tema; los tokens se diseñan
  intercambiables desde el inicio y los otros 3 llegan en una entrega propia.

## Feedback ronda 1 (2026-10-09)

- **Vinkolo:** el nombre gustaba, pero los aros entrelazados lo hacen parecer una app de citas.
- **Bonduu:** el logo y la marca gustan, pero el nombre se confunde con Badoo (citas).
- **Hilvanu:** original, pero la "h" minúscula no convence y la marca resulta demasiado tierna o infantil.
- **Criterios nuevos:** nada que remita a apps de citas (aros, abrazos, corazones, terminaciones "-oo", "-uu" u "-olo"). Cercana pero **adulta**. No se descartan los conceptos anteriores. Explorar paletas y logos nuevos.

## Ronda 2 de nombres

Los `.com` cortos están todos registrados; se aceptan `.app`, `.link` y `.page` (más `get<nombre>.com` como opción).

| Nombre | Idea | Dominios libres | Uso visible en la web |
|---|---|---|---|
| Lazen | Lazo/enlazar + "zen" (calma) | lazen.app, .link, .page, getlazen.com | No |
| Trelia | Enrejado (trellis): estructura donde todo crece conectado | trelia.app, .link, .page | No |
| Unira | Unir | unira.app, .link, .page | No |
| Aunio | Aunar (juntar esfuerzos) | aunio.app | Parecidos: Auni AI, Unio |
| ~~Teselia~~ | Teselas, mosaico | teselia.app | Descartado: es el nombre en español de la región Unova de Pokémon |

## Pendiente

- Elegir nombre final y revisar marcas registradas (INPI Argentina, EUIPO, USPTO).
- Logotipo, isotipo, imagotipo, paleta y tipografía (`brandkit`).
- Sistema de diseño y tokens con temas (`impeccable`).

## Ronda 3 (2026-10-09)

Lista corta: **Plektia** (plektia.com y .app libres) y **Catenio** (catenio.app libre), más Vinkolo, Bonduu y Hilvanu. Descartados: Lazen, Trelia, Unira y Aunio (en uso según el usuario) e Iunga (marca IUNGO). Se exploran 4 direcciones (nodos y red, monograma geométrico, señal y pulso, tipográfico) con 4 familias de paleta.

## Dirección visual de la página pública (2026-10-09)

Elegida: **Patchera con hilo** (dirección asignada por el dado de impeccable, seed `2a81963b`).

- Cada link es un puerto con su jack; un **hilo** (trazo trenzado hueso) enhebra todos los jacks con curvas variables hacia ambos lados, sin cruzar nunca el texto. Empieza con un nudo en el primer link y termina suelto en el último; no sale del logo.
- Encabezado con el **avatar del usuario**; el logo de Plektia va en un pie discreto ("Hecho con Plektia").
- **En vivo:** el jack y el tramo de hilo que llega a él se ponen lima y el jack late (pulso). Los demás links mantienen brillo pleno: nada se ve apagado ni desactualizado.
- **Último video de YouTube:** línea plegable con título y antigüedad; al tocarla se despliega la miniatura.
- **Sin numeración** de links.
- Secciones con título (REDES, PROYECTOS…) que el usuario crea, ordena, renombra u oculta desde el panel.
- Animaciones: enhebrado único al cargar y tensado del tramo al enfocar un link; todas respetan `prefers-reduced-motion`.
- **Variante en reserva:** fusión patchera + subte (línea troncal con nodos y secciones como tramos de color). Puede convertirse en un segundo estilo de página elegible.
