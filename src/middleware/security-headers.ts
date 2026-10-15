import type { MiddlewareHandler } from "astro";

import { applySecurityHeaders } from "@/infrastructure/http/security-headers";

/** Cabeceras de seguridad en toda respuesta, incluidas las redirecciones. */
export const securityHeadersMiddleware: MiddlewareHandler = async (_context, next) => {
  const response = await next();
  applySecurityHeaders(response.headers);
  return response;
};
