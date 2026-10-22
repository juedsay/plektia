import type { MiddlewareHandler } from "astro";

import { cachePolicy } from "@/infrastructure/http/cache-policy";

/**
 * `Cache-Control` y `Cache-Tag` de cada respuesta según la política de caché.
 * La caché del Worker guarda lo público y respeta `private`/`no-store`.
 *
 * Las cookies que se escriben con `context.cookies` llegan a la respuesta
 * recién al final, así que acá no siempre se ven: por eso las rutas que tocan
 * la sesión son `no-store` por ruta (`usesSession`), no por cookie.
 */
export const cacheMiddleware: MiddlewareHandler = async (context, next) => {
  const response = await next();
  const policy = cachePolicy({
    pathname: context.url.pathname,
    method: context.request.method,
    status: response.status,
    setsCookie: response.headers.has("set-cookie"),
  });
  response.headers.set("Cache-Control", policy.cacheControl);
  if (policy.tags.length > 0) response.headers.set("Cache-Tag", policy.tags.join(","));
  else response.headers.delete("Cache-Tag");
  return response;
};
