// @ts-check
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { defineConfig, fontProviders } from "astro/config";

export default defineConfig({
  // Todo se renderiza en el Worker salvo las páginas que declaren `prerender`.
  output: "server",
  adapter: cloudflare({
    // Sin binding de Cloudflare Images: los avatares ya llegan optimizados (WebP 512 px)
    // y las miniaturas vienen de YouTube.
    imageService: "passthrough",
  }),
  // Sin sesiones de Astro (y sin el KV que el adaptador provisiona para ellas):
  // la sesión vive en las cookies de Supabase (ver SPEC-identity).
  session: false,
  security: {
    // Rechaza envíos de formularios y Actions que no vengan del mismo origen (CSRF).
    checkOrigin: true,
    // CSP con hashes automáticos para scripts y estilos: sin 'unsafe-inline'.
    // Las directivas que solo funcionan como cabecera (frame-ancestors) las
    // agrega el middleware (src/infrastructure/http/security-headers.ts).
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
      ],
    },
  },
  // Fuente de la marca servida desde el propio sitio (cero pedidos a Google):
  // solo el subset latino con eje óptico. Astro genera la precarga y un respaldo
  // con métricas ajustadas para que el cambio de fuente no mueva el layout.
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Bricolage Grotesque",
      cssVariable: "--font-brand",
      fallbacks: ["system-ui", "sans-serif"],
      options: {
        variants: [
          {
            weight: "200 800",
            style: "normal",
            src: [
              "./node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2",
            ],
          },
        ],
      },
    },
    // Tipografías de los nombres que puede elegir cada página (SPEC-appearance,
    // 36c): mismo origen auditado (fontsource, OFL-1.1) y solo el subset latino.
    {
      provider: fontProviders.local(),
      name: "Fraunces",
      cssVariable: "--font-fraunces",
      fallbacks: ["Georgia", "serif"],
      options: {
        variants: [
          {
            weight: "100 900",
            style: "normal",
            src: [
              "./node_modules/@fontsource-variable/fraunces/files/fraunces-latin-soft-normal.woff2",
            ],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "Nunito",
      cssVariable: "--font-nunito",
      fallbacks: ["system-ui", "sans-serif"],
      options: {
        variants: [
          {
            weight: "200 1000",
            style: "normal",
            src: [
              "./node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2",
            ],
          },
        ],
      },
    },
    // Letra manuscrita de los títulos de Lado A / B (SPEC-styles): solo en esa
    // variante, sin precarga (el resto de la página no la usa).
    {
      provider: fontProviders.local(),
      name: "Kalam",
      cssVariable: "--font-hand",
      fallbacks: ["cursive"],
      options: {
        variants: [
          {
            weight: 700,
            style: "normal",
            src: ["./node_modules/@fontsource/kalam/files/kalam-latin-700-normal.woff2"],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "Space Mono",
      cssVariable: "--font-space-mono",
      fallbacks: ["ui-monospace", "monospace"],
      options: {
        variants: [
          {
            weight: 400,
            style: "normal",
            src: ["./node_modules/@fontsource/space-mono/files/space-mono-latin-400-normal.woff2"],
          },
          {
            weight: 700,
            style: "normal",
            src: ["./node_modules/@fontsource/space-mono/files/space-mono-latin-700-normal.woff2"],
          },
        ],
      },
    },
  ],
  build: {
    // El CSS de la página pública pesa ~3 KB comprimido: en línea no bloquea el
    // primer render (Lighthouse, tarea 17). Astro lo agrega a la CSP con su hash.
    inlineStylesheets: "always",
  },
  integrations: [react()],
});
