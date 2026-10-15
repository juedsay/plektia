import type { MiddlewareHandler } from "astro";

import { loginRedirect, requiresSession } from "@/infrastructure/http/route-access";

/** Sin sesión, las rutas protegidas mandan al login y vuelven después (`next`). */
export const adminGuardMiddleware: MiddlewareHandler = (context, next) => {
  const { pathname, search } = context.url;
  if (requiresSession(pathname) && !context.locals.user) {
    return new Response(null, {
      status: 302,
      headers: { Location: loginRedirect(pathname, search) },
    });
  }
  return next();
};
