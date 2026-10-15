import type { APIRoute } from "astro";

import { authGatewayFor } from "@/composition/runtime";
import { loginErrorRedirect, seeOther } from "@/infrastructure/http/route-access";
import { safeRedirectPath } from "@/infrastructure/http/safe-redirect";

// Vuelta del proveedor. Cualquier falla (cuenta no invitada, código vencido o
// reusado) termina en el mismo aviso: no se revela por qué (SPEC-identity).
export const GET: APIRoute = async ({ request, cookies, url }) => {
  const next = safeRedirectPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  if (!code) return seeOther(loginErrorRedirect(next));

  const result = await authGatewayFor(request, cookies).completeSignIn(code);
  return seeOther(result.ok ? next : loginErrorRedirect(next));
};
