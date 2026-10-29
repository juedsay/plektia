import type { APIRoute } from "astro";

import { setPanelMode } from "@/application/account/panel-mode";
import { actionsRateLimiter, adminRepositoriesFor } from "@/composition/runtime";
import { safeRedirectPath } from "@/infrastructure/http/safe-redirect";
import { seeOther } from "@/infrastructure/http/route-access";

// Modo del panel (SPEC-appearance, tarea 35): el formulario de "Apariencia" del
// marco del panel. Guarda la elección y vuelve a la misma pantalla (POST/
// Redirect/GET), así recargar no reenvía. `/admin` exige sesión (middleware) y
// Astro rechaza formularios de otro origen (`checkOrigin`).

/** Solo se vuelve a una pantalla del panel; cualquier otra cosa, al inicio. */
function backTo(next: FormDataEntryValue | null): string {
  const path = safeRedirectPath(typeof next === "string" ? next : null);
  return path === "/admin" || path.startsWith("/admin/") || path.startsWith("/admin?")
    ? path
    : "/admin";
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const user = locals.user;
  if (!user) return seeOther("/login");
  const form = await request.formData();
  const next = backTo(form.get("next"));
  if (!(await actionsRateLimiter().allow(user.id))) return seeOther(next);

  const { preferences } = adminRepositoriesFor(request, cookies, user.id);
  const saved = await setPanelMode({ preferences })({ panelMode: form.get("panelMode") });
  if (!saved.ok) console.warn("apariencia: no se guardó el modo del panel", saved.error);
  return seeOther(next);
};
