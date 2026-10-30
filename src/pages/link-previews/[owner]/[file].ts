import type { APIRoute } from "astro";

import { linkPreviewImage } from "@/composition/runtime";

// Imagen de la vista previa de un artículo, servida desde el propio sitio
// (SPEC-link-form, 7c-2). La ruta lleva un nombre nuevo en cada cambio: se
// cachea un año.
export const GET: APIRoute = async ({ params }) => {
  const image = await linkPreviewImage(`${params["owner"] ?? ""}/${params["file"] ?? ""}`);
  if (!image) return new Response(null, { status: 404 });
  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.contentType,
      // Si alguien abre la imagen sola, no puede correr nada ni cargar nada.
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    },
  });
};
