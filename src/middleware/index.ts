// Cadena de middlewares: acá se conectan con sus dependencias reales. El orden
// importa: las cabeceras envuelven todo y la sesión se lee antes del control
// de acceso.
import { env } from "cloudflare:workers";
import { sequence } from "astro:middleware";

import { createSessionReader } from "@/composition/session";
import { adminGuardMiddleware } from "@/middleware/admin-guard";
import { securityHeadersMiddleware } from "@/middleware/security-headers";
import { sessionMiddleware } from "@/middleware/session";

const session = sessionMiddleware((request, cookies) =>
  createSessionReader(
    { url: env.SUPABASE_URL, publishableKey: env.SUPABASE_PUBLISHABLE_KEY },
    request,
    cookies,
  ),
);

export const onRequest = sequence(securityHeadersMiddleware, session, adminGuardMiddleware);
