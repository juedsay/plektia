import type { AstroCookies } from "astro";

import { listPages } from "@/application/pages/list-pages";
import type { Page } from "@/application/ports/page-repository";
import type { AdminRepositories } from "@/composition/admin";
import { adminRepositoriesFor } from "@/composition/runtime";

/** Lo que necesita cualquier pantalla del panel: las páginas y con cuál se trabaja. */
export interface AdminWorkspace {
  readonly repositories: AdminRepositories;
  readonly pages: readonly Page[];
  /** La página elegida; `null` solo si la cuenta no tiene ninguna (no debería pasar). */
  readonly currentPage: Page | null;
}

interface RequestContext {
  readonly request: Request;
  readonly cookies: AstroCookies;
  readonly locals: App.Locals;
}

export async function loadWorkspace({
  request,
  cookies,
  locals,
}: RequestContext): Promise<AdminWorkspace> {
  // El middleware ya mandó al login a quien no tiene sesión.
  if (!locals.user) throw new Error("panel: falta la sesión");
  const repositories = adminRepositoriesFor(request, cookies, locals.user.id);
  const { pages, currentPageId } = await listPages({ pages: repositories.pages })();
  const currentPage = pages.find((page) => page.id === currentPageId) ?? null;
  return { repositories, pages, currentPage };
}
