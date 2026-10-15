import type { APIRoute } from "astro";
import { z } from "zod";

import { OAUTH_PROVIDERS } from "@/application/ports/auth-gateway";
import { authGatewayFor } from "@/composition/runtime";
import { loginErrorRedirect } from "@/infrastructure/http/route-access";
import { safeRedirectPath } from "@/infrastructure/http/safe-redirect";

const Provider = z.enum(OAUTH_PROVIDERS);

// GET (un link) y no un formulario: la CSP tiene `form-action 'self'` y el
// navegador la aplica también a las redirecciones que siguen a un envío, así que
// un POST que redirige al proveedor queda bloqueado. Iniciar el login con un link
// es seguro: PKCE ata el código a la cookie de este navegador, y nadie puede
// meter a otro en su cuenta con un link. El límite de intentos sigue aplicando.
export const GET: APIRoute = async ({ request, cookies, url }) => {
  const next = safeRedirectPath(url.searchParams.get("next"));
  const provider = Provider.safeParse(url.searchParams.get("provider"));
  if (!provider.success) return found(loginErrorRedirect(next));

  const callback = new URL("/auth/callback", url.origin);
  callback.searchParams.set("next", next);
  const result = await authGatewayFor(request, cookies).startSignIn(provider.data, callback.href);
  return found(result.ok ? result.value : loginErrorRedirect(next));
};

function found(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}
