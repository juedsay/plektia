import type { PageCache } from "@/application/ports/page-cache";
import type { Page, PageReader, PageWriter } from "@/application/ports/page-repository";
import type { UseCaseResult } from "@/application/shared/use-case";
import { invalidInput } from "@/domain/errors";
import { PAGE_LIMIT, parsePageInput } from "@/domain/page";
import { err, ok } from "@/domain/result";

export function createPage(deps: { pages: PageReader & PageWriter; cache: PageCache }) {
  return async (raw: unknown): UseCaseResult<Page> => {
    const draft = parsePageInput(raw);
    if (!draft.ok) return draft;
    // Aviso rápido; el límite real lo aplica la base (también con altas simultáneas).
    if ((await deps.pages.listOwn()).length >= PAGE_LIMIT) return err("limit_reached");

    const created = await deps.pages.createPage(draft.value);
    if (created.ok) {
      // La caché pudo guardar el 404 de ese handle, y el sitemap lista las páginas.
      await Promise.all([deps.cache.purgeProfile(created.value.handle), deps.cache.purgeSite()]);
      return ok(created.value);
    }
    if (created.error === "handle_taken") {
      return err(invalidInput({ handle: "Ese nombre de usuario ya lo usa otra página." }));
    }
    return err(created.error);
  };
}
