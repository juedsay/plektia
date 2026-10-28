import type { APIRoute } from "astro";

import { youtubeThumbnail } from "@/composition/runtime";

// Miniatura del contenido destacado, servida desde el propio sitio
// (SPEC-live-status): la página pública no le pide nada a YouTube.
export const GET: APIRoute = async ({ params }) => {
  const thumbnail = await youtubeThumbnail(params["file"] ?? "");
  if (!thumbnail) return new Response(null, { status: 404 });
  return new Response(thumbnail.bytes, {
    headers: {
      "Content-Type": "image/jpeg",
      // Si alguien abre la imagen sola, no puede correr nada ni cargar nada.
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    },
  });
};
