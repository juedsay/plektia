import { defineMiddleware } from "astro:middleware";

import { applySecurityHeaders } from "@/infrastructure/http/security-headers";

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  applySecurityHeaders(response.headers);
  return response;
});
