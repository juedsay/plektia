// @ts-check
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

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
  integrations: [react()],
});
