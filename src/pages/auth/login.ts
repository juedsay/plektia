import type { APIRoute } from "astro";
import { z } from "zod";

import { OAUTH_PROVIDERS } from "@/application/ports/auth-gateway";
import { authGatewayFor } from "@/composition/runtime";
import { readForm } from "@/infrastructure/http/form";
import { loginErrorRedirect, seeOther } from "@/infrastructure/http/route-access";
import { safeRedirectPath } from "@/infrastructure/http/safe-redirect";

const Provider = z.enum(OAUTH_PROVIDERS);

// Solo POST: `security.checkOrigin` de Astro rechaza formularios de otro sitio (CSRF).
export const POST: APIRoute = async ({ request, cookies, url }) => {
  const form = await readForm(request);
  const next = safeRedirectPath(form.get("next"));
  const provider = Provider.safeParse(form.get("provider"));
  if (!provider.success) return seeOther(loginErrorRedirect(next));

  const callback = new URL("/auth/callback", url.origin);
  callback.searchParams.set("next", next);
  const result = await authGatewayFor(request, cookies).startSignIn(provider.data, callback.href);
  return seeOther(result.ok ? result.value : loginErrorRedirect(next));
};
