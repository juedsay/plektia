import type { APIRoute } from "astro";

import { avatarImage } from "@/composition/runtime";

// Avatar de una página, servido desde el propio sitio (SPEC-admin-panel,
// "Avatar"). La ruta lleva un nombre nuevo en cada cambio: se cachea un año.
export const GET: APIRoute = async ({ params }) => {
  const image = await avatarImage(`${params["owner"] ?? ""}/${params["file"] ?? ""}`);
  if (!image) return new Response(null, { status: 404 });
  return new Response(image, { headers: { "Content-Type": "image/webp" } });
};
