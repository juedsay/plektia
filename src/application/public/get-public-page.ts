import type { PublicPage, PublicPageReader } from "@/application/ports/public-page-reader";
import { parseExistingHandle } from "@/domain/handle";
import { err, ok, type Result } from "@/domain/result";

/**
 * Página pública de un handle (también la oficial, `/plektia`). Un handle mal
 * formado o reservado no llega a la base: para quien visita es lo mismo que un
 * perfil que no existe.
 */
export function getPublicPage(deps: { pages: PublicPageReader }) {
  return async (rawHandle: unknown): Promise<Result<PublicPage, "not_found">> => {
    const handle = parseExistingHandle(rawHandle);
    if (!handle.ok) return err("not_found");
    const page = await deps.pages.getByHandle(handle.value);
    return page ? ok(page) : err("not_found");
  };
}
