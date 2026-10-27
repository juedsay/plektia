import type { PageCache } from "@/application/ports/page-cache";
import type { Page, PageReader, PageWriter } from "@/application/ports/page-repository";
import { requestIdOf } from "@/application/shared/request-id";
import type { UseCaseResult } from "@/application/shared/use-case";
import { invalidInput } from "@/domain/errors";
import { PAGE_LIMIT, parsePageInput } from "@/domain/page";
import { err, ok } from "@/domain/result";

export function createPage(deps: { pages: PageReader & PageWriter; cache: PageCache }) {
  return async (raw: unknown): UseCaseResult<Page> => {
    const draft = parsePageInput(raw);
    if (!draft.ok) return draft;
    const id = requestIdOf(raw);
    if (!id.ok) return id;

    const withId = (pages: readonly Page[]) =>
      id.value === undefined ? undefined : pages.find((page) => page.id === id.value);

    // El mismo pedido otra vez (doble envío del formulario): la página ya está.
    // Va antes del límite, que la página recién creada pudo haber completado.
    const pages = await deps.pages.listOwn();
    const existing = withId(pages);
    if (existing) return ok(existing);

    // Aviso rápido; el límite real lo aplica la base (también con altas simultáneas).
    if (pages.length >= PAGE_LIMIT) return err("limit_reached");

    const created = await deps.pages.createPage(draft.value, id.value);
    if (created.ok) {
      // La caché pudo guardar el 404 de ese handle, y el sitemap lista las páginas.
      await Promise.all([deps.cache.purgeProfile(created.value.handle), deps.cache.purgeSite()]);
      return ok(created.value);
    }
    // Dos envíos simultáneos: el otro la creó primero con este mismo id (y este
    // chocó con el handle, con el id o con el límite que esa página completó).
    if (id.value !== undefined) {
      const createdMeanwhile = withId(await deps.pages.listOwn());
      if (createdMeanwhile) return ok(createdMeanwhile);
    }
    if (created.error === "handle_taken") {
      return err(invalidInput({ handle: "Ese nombre de usuario ya lo usa otra página." }));
    }
    return err(created.error);
  };
}
