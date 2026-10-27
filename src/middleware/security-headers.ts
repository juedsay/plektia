import type { MiddlewareHandler } from "astro";

import { isFrameable } from "@/infrastructure/http/route-access";
import { applySecurityHeaders } from "@/infrastructure/http/security-headers";

/** Cabeceras de seguridad en toda respuesta, incluidas las redirecciones. */
export const securityHeadersMiddleware: MiddlewareHandler = async (context, next) => {
  const response = await next();
  applySecurityHeaders(response.headers, { frameable: isFrameable(context.url.pathname) });
  return response;
};
