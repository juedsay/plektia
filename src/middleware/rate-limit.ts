import type { MiddlewareHandler } from "astro";

import type { RateLimiter } from "@/application/ports/rate-limiter";
import { isRateLimited } from "@/infrastructure/http/route-access";

/**
 * Limita las acciones de login por IP y ruta (SPEC-identity: 10 por minuto).
 * En login no hay otro identificador estable: el visitante todavía no es nadie.
 */
export function rateLimitMiddleware(createLimiter: () => RateLimiter): MiddlewareHandler {
  return async (context, next) => {
    if (!isRateLimited(context.url.pathname)) return next();

    const allowed = await createLimiter().allow(`${context.clientAddress}:${context.url.pathname}`);
    if (allowed) return next();
    return new Response("Demasiados intentos. Esperá un minuto y probá de nuevo.", {
      status: 429,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "60" },
    });
  };
}
