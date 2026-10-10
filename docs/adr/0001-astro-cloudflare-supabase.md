# ADR 0001: Astro + Cloudflare Workers + Supabase

- **Estado:** aceptada
- **Fecha:** 2026-10-09

## Contexto

Plektia es una página pública de links que se abre sobre todo en el celular, desde navegadores embebidos de redes sociales y con datos móviles, más un panel privado y un servidor MCP. Las prioridades son rendimiento, seguridad y que sirva como pieza de portfolio con buenos tests. La primera opción evaluada fue Next.js en Vercel con Supabase.

## Decisión

- **Astro 7** con islas React solo donde hace falta interactividad (el editor del panel).
- **Cloudflare Workers** (`@astrojs/cloudflare`) como hosting, con Cron Triggers y Workers Cache.
- **Supabase** para Postgres con RLS, autenticación (GitHub y Google) y servidor OAuth 2.1 para el MCP.

## Motivos

- La página pública es casi estática: Astro la entrega sin JavaScript de framework. Next.js siempre carga React.
- Cloudflare mantiene Astro desde 2026, así que el adaptador es de primera línea. Además permite crons de pocos minutos en el plan gratuito (en Vercel Hobby son diarios) y cachear las respuestas del Worker con purga por etiqueta desde el propio código, sin tokens de API.
- Supabase lleva la autorización a la base (RLS), que es más fácil de probar (pgTAP) y de mantener segura cuando el producto sea multiusuario.

## Consecuencias

- Menos ecosistema y menos presencia en ofertas de trabajo que Next.js.
- El runtime es workerd, no Node: algunas librerías de Node no sirven. Se habilita `nodejs_compat` y se eligen dependencias compatibles con APIs web.
- Sin sesiones de Astro ni Cloudflare Images (`session: false`, `imageService: "passthrough"`): la sesión vive en las cookies de Supabase y las imágenes llegan ya optimizadas.
- `global_fetch_strictly_public` impide que `fetch()` alcance IPs internas: es la primera barrera contra SSRF.
