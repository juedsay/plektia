import type { AstroCookies, MiddlewareHandler } from "astro";

import type { SessionReader } from "@/application/ports/session-reader";
import { usesSession } from "@/infrastructure/http/route-access";

export type SessionReaderFactory = (request: Request, cookies: AstroCookies) => SessionReader;

/**
 * Deja en `locals.user` quién hace el pedido, solo en las rutas que usan sesión.
 * El lector se inyecta: este middleware no sabe de Supabase ni de Cloudflare.
 */
export function sessionMiddleware(createReader: SessionReaderFactory): MiddlewareHandler {
  return async (context, next) => {
    context.locals.user = null;
    if (!usesSession(context.url.pathname)) return next();

    context.locals.user = await createReader(context.request, context.cookies).getCurrentUser();
    const response = await next();
    // Las respuestas con sesión nunca se cachean: podrían llevar la cookie de otro.
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
}
