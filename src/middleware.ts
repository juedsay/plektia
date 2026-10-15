import { env } from "cloudflare:workers";
import { defineMiddleware } from "astro:middleware";

import { createSessionReader } from "@/composition/session";
import { loginRedirect, requiresSession, usesSession } from "@/domain/access";
import { applySecurityHeaders } from "@/infrastructure/http/security-headers";

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  context.locals.user = null;

  const sessionRoute = usesSession(pathname);
  if (sessionRoute) {
    const reader = createSessionReader(
      { url: env.SUPABASE_URL, publishableKey: env.SUPABASE_PUBLISHABLE_KEY },
      context.request,
      context.cookies,
    );
    context.locals.user = await reader.getCurrentUser();
  }

  const response =
    requiresSession(pathname) && !context.locals.user
      ? new Response(null, { status: 302, headers: { Location: loginRedirect(pathname, search) } })
      : await next();

  // Las respuestas con sesión nunca se cachean: podrían llevar la cookie de otro.
  if (sessionRoute) response.headers.set("Cache-Control", "private, no-store");
  applySecurityHeaders(response.headers);
  return response;
});
