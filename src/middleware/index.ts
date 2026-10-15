// Cadena de middlewares. El orden importa: las cabeceras envuelven todo, el
// límite corta antes de tocar Supabase y la sesión se lee antes del acceso.
import { sequence } from "astro:middleware";

import { authRateLimiter, sessionReaderFor } from "@/composition/runtime";
import { adminGuardMiddleware } from "@/middleware/admin-guard";
import { rateLimitMiddleware } from "@/middleware/rate-limit";
import { securityHeadersMiddleware } from "@/middleware/security-headers";
import { sessionMiddleware } from "@/middleware/session";

export const onRequest = sequence(
  securityHeadersMiddleware,
  rateLimitMiddleware(authRateLimiter),
  sessionMiddleware(sessionReaderFor),
  adminGuardMiddleware,
);
