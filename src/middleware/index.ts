// Cadena de middlewares. El orden importa: las cabeceras envuelven todo, la
// caché decide sobre la respuesta final, el
// límite corta antes de tocar Supabase y la sesión se lee antes del acceso.
import { sequence } from "astro:middleware";

import { authRateLimiter, sessionReaderFor } from "@/composition/runtime";
import { adminGuardMiddleware } from "@/middleware/admin-guard";
import { cacheMiddleware } from "@/middleware/cache";
import { rateLimitMiddleware } from "@/middleware/rate-limit";
import { requestSizeMiddleware } from "@/middleware/request-size";
import { securityHeadersMiddleware } from "@/middleware/security-headers";
import { sessionMiddleware } from "@/middleware/session";

export const onRequest = sequence(
  securityHeadersMiddleware,
  // Después de las cabeceras de seguridad y antes de todo lo demás: decide qué
  // se cachea mirando la respuesta final (incluido si alguien puso una cookie).
  cacheMiddleware,
  // Antes de leer nada: un cuerpo de más se corta sin llegar a la Action.
  requestSizeMiddleware,
  rateLimitMiddleware(authRateLimiter),
  sessionMiddleware(sessionReaderFor),
  adminGuardMiddleware,
);
