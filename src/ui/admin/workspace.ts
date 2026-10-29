import type { AstroCookies } from "astro";

import { listPages } from "@/application/pages/list-pages";
import type { Page } from "@/application/ports/page-repository";
import type { CurrentAccount } from "@/application/ports/user-directory";
import type { ColorMode } from "@/domain/page";
import type { AdminRepositories } from "@/composition/admin";
import { adminRepositoriesFor } from "@/composition/runtime";

/** Lo que necesita cualquier pantalla del panel: la cuenta, sus páginas y con cuál se trabaja. */
export interface AdminWorkspace {
  readonly repositories: AdminRepositories;
  readonly pages: readonly Page[];
  /** La página elegida; `null` solo si la cuenta no tiene ninguna (no debería pasar). */
  readonly currentPage: Page | null;
  /** Rol y si sigue activa; sin perfil (no debería pasar), como un `member` dado de baja. */
  readonly account: CurrentAccount;
  /** El modo del panel que eligió la cuenta (`auto` si nunca eligió). */
  readonly panelMode: ColorMode;
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
  const [{ pages, currentPageId }, account, panelMode] = await Promise.all([
    listPages({ pages: repositories.pages })(),
    repositories.users.currentAccount(),
    repositories.preferences.panelMode(),
  ]);
  const currentPage = pages.find((page) => page.id === currentPageId) ?? null;
  return {
    repositories,
    pages,
    currentPage,
    account: account ?? { role: "member", disabled: true },
    panelMode,
  };
}

/** Si la cuenta de la sesión puede administrar usuarios (owner activo). */
export function isActiveOwner(account: CurrentAccount): boolean {
  return account.role === "owner" && !account.disabled;
}
