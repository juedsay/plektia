import type { APIRoute } from "astro";

import { authGatewayFor } from "@/composition/runtime";
import { readForm } from "@/infrastructure/http/form";
import { seeOther } from "@/infrastructure/http/route-access";

// Solo POST (un link GET permitiría cerrar la sesión de alguien desde otro sitio).
export const POST: APIRoute = async ({ request, cookies }) => {
  const form = await readForm(request);
  const scope = form.get("scope") === "global" ? "global" : "local";
  await authGatewayFor(request, cookies).signOut(scope);
  return seeOther("/login");
};
