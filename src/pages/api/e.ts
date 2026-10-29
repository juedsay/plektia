import type { APIRoute } from "astro";

import { statsEvents } from "@/composition/runtime";

// Beacon de estadísticas (SPEC-click-analytics, "Endpoint POST /api/e"):
// visitas y clics de la página pública. Responde siempre 204, haya contado o
// no: no revela qué existe ni si el límite se agotó.

/** Más grande que esto no es un evento (`{"t":"click","l":"<uuid>","s":"instagram"}`). */
const MAX_BODY_BYTES = 512;
const ACCEPTED_TYPES = ["text/plain", "application/json"];

const noContent = () =>
  new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });

/** Descarta el cuerpo sin leerlo (dejarlo colgado corta la conexión) y responde 204. */
async function ignore(request: Request): Promise<Response> {
  await request.body?.cancel().catch(() => undefined);
  return noContent();
}

export const POST: APIRoute = async ({ request, url, clientAddress, locals }) => {
  // Solo desde el propio sitio (el beacon lo manda la página pública).
  if (request.headers.get("origin") !== url.origin) return ignore(request);
  const type = (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
  if (!type || !ACCEPTED_TYPES.includes(type)) return ignore(request);
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) return ignore(request);

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) return noContent();

  // El país lo informa Cloudflare; la IP solo sirve para el límite y no se guarda.
  const country = (request as Request & { cf?: { country?: unknown } }).cf?.country;
  try {
    await statsEvents()({ body, ip: clientAddress, country, viewerId: locals.user?.id ?? null });
  } catch (error) {
    // Una métrica perdida no le importa a quien visita: queda en el log.
    console.error("estadísticas: no se pudo registrar el evento", error);
  }
  return noContent();
};

// Cualquier otro método: lo mismo que un evento ignorado.
export const ALL: APIRoute = ({ request }) => ignore(request);
