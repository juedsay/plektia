# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro 7 con islas React 19 (solo donde hace falta interactividad), desplegado en Cloudflare Workers; Supabase (Postgres + RLS + Auth); pnpm. Detalle en [SPEC-platform.md](SPEC-platform.md).

## Users

- **Visitante (prioridad del diseño):** llega a `plektia.app/{handle}` desde un link en la bio de una red social, casi siempre en el celular, y se queda unos segundos. Quiere encontrar rápido el link que busca y saber si la persona está transmitiendo en vivo.
- **Dueño de la página:** arma y mantiene su página desde el panel web o desde su agente de IA (servidor MCP). En la v1 es una sola persona (`juedsay`); más adelante, usuarios habilitados por invitación.

## Product Purpose

Reunir en una sola página todas las redes, sitios, canales y artículos de una persona, agrupados por secciones, y mostrar en tiempo casi real si está en vivo en YouTube o Twitch y cuál es su último video de YouTube. Éxito: el visitante llega al destino correcto en uno o dos toques, y el dueño mantiene la página sin esfuerzo.

## Positioning

La página está viva: detecta los streams en vivo y muestra el último contenido sin que el dueño toque nada. Además, se administra desde un agente de IA vía MCP, no solo desde un panel.

## Operating Context

- El visitante entra desde apps de redes sociales (navegadores embebidos de Instagram, TikTok, X), a menudo con conexión móvil.
- El dueño edita desde el panel web (escritorio o celular) o conversando con su agente (por ejemplo Claude).
- Proyecto de portfolio con foco en seguridad y testing; el repo se hará público.

## Capabilities and Constraints

- Links agrupados por **secciones** con título; las etiquetas se guardan pero el filtro público llega después.
- Estado **en vivo** (YouTube, Twitch) como indicador en el link; Kick en v2.
- Último video de YouTube.
- Conteo de clics por link, sin cookies ni datos personales.
- **4 temas** elegibles por usuario para su página pública (técnico, cercano, enérgico, editorial). La v1 implementa uno; los tokens se diseñan intercambiables desde el inicio.
- Registro cerrado: solo entran usuarios habilitados por el owner. Login con GitHub y Google.
- Sin decidir: dominio propio (por ahora `*.workers.dev`), compra de `plektia.com`/`plektia.app`.

## Brand Commitments

- **Nombre:** Plektia (del griego *plektós*, "tejido, entrelazado"). Tagline de trabajo: "Todo tejido."
- **Personalidad:** cercana y relajada, pero adulta. Nada que remita a apps de citas (aros entrelazados, abrazos, corazones) ni tono infantil.
- **Identidad aprobada** (detalle y archivos en [docs/brand/](docs/brand/brief.md)): isotipo "P" de nodos con un nodo de acento como señal de en vivo; logotipo en minúsculas con Bricolage Grotesque; paleta negro `#121315`, hueso `#F2F2EE`, lima `#C6F432`, grafito `#3A3D42`.
- **Voz:** español rioplatense en la interfaz.

## Evidence on Hand

- Assets de marca en `docs/brand/plektia/` (isotipos SVG, ícono de app, lámina).
- No hay testimonios, métricas, usuarios ni casos reales: no inventarlos.

## Product Principles

1. **El visitante primero:** cada decisión de la página pública se mide por cuán rápido llega al link correcto.
2. **Viva pero liviana:** el estado en vivo no puede costar rendimiento; la página carga como si fuera estática.
3. **Seguro por defecto:** la seguridad no se negocia por conveniencia (RLS, CSP, validación en el borde).
4. **Un mismo núcleo, varias entradas:** panel, API y MCP hacen lo mismo con las mismas reglas.
5. **El dueño se expresa en su página, la marca Plektia se queda atrás:** los temas personalizan sin romper la estructura.

## Accessibility & Inclusion

- **Página pública: WCAG 2.2 nivel AAA** (contraste de texto 7:1, 4.5:1 en texto grande; foco visible; navegación completa por teclado; respeta `prefers-reduced-motion`). Los 4 temas deben cumplirlo.
- **Panel y resto del sitio:** WCAG 2.2 AA como mínimo.
- Verificación automática con axe en los tests E2E (Playwright).
