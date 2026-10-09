---
version: 1
slug: "prototypes-public-page-index-html"
primary_target: "prototypes/public-page/index.html"
related_targets: []
---

# Página pública de perfil (`/{handle}`)

## Scope and mode

Operate. El visitante llega desde la bio de una red social, en el celular, y quiere encontrar un link o ver si la persona está en vivo. Prototipo estático en `prototypes/public-page/` que después se porta a Astro.

## Audience, job, constraints

- Visitante en navegador embebido de apps sociales, a menudo de noche y con datos móviles.
- WCAG 2.2 AAA (texto 7:1), teclado completo, `prefers-reduced-motion`.
- Sin JS de framework: el hilo es un script chico que dibuja encima sin mover el layout.
- Datos de ejemplo sintéticos (perfil juedsay): reemplazar por datos reales al portar.

## Direction contract

THESIS: La página es una patchera: cada link es un jack y un hilo los enhebra a todos; lo que está en vivo se enciende. Rechaza la columna de botones redondeados centrados de la categoría.

OWN-WORLD: Negro #121315, texto hueso #F2F2EE, lima #C6F432 reservada a la señal en vivo, grafito #3A3D42 para filetes de 1 px. Jacks anillados, hilo trenzado hueso, títulos de sección en Bricolage Grotesque, nada de sombras ni tarjetas.

STORY: El visitante ve quién es la persona, nota al instante si está en vivo, recorre las secciones siguiendo el hilo y toca el link que buscaba; puede desplegar el último video o compartir la página.

FIRST VIEWPORT: Barra superior con el isotipo de Plektia a la izquierda (invitación a crear tu página) y compartir a la derecha; avatar centrado con nombre y bio; debajo, la primera sección con el link en vivo arriba, su jack lima latiendo y el tramo de hilo encendido.

FORM: Patchera con hilo, candidata 3 de la lista propia (asignada por el dado), seed 2a81963b. Interacción firma: el hilo se enhebra al cargar con una forma distinta en cada visita y se tensa hacia el link enfocado.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Contenido del pie (por ahora solo "Hecho con Plektia").
- Destino del isotipo superior mientras el registro esté cerrado (lista de espera o pedido de acceso).
- Variante en reserva: fusión patchera + subte.
