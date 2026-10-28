import type { MiddlewareHandler } from "astro";

import { checkBodySize } from "@/infrastructure/http/request-limits";

/** Corta los pedidos más pesados de lo permitido antes de leer su cuerpo (413) o sin largo (411). */
export const requestSizeMiddleware: MiddlewareHandler = (context, next) => {
  const check = checkBodySize({
    method: context.request.method,
    pathname: context.url.pathname,
    search: context.url.search,
    contentLength: context.request.headers.get("content-length"),
  });
  if (!check.ok) return Promise.resolve(new Response(null, { status: check.status }));
  return next();
};
