import { z } from "zod";

import type { PageCache } from "@/application/ports/page-cache";
import type { Page, PageWriter } from "@/application/ports/page-repository";
import type { UseCaseResult } from "@/application/shared/use-case";
import { parsePageSettings } from "@/domain/page";
import { validate } from "@/domain/text";

const PageIdSchema = z.object(
  { pageId: z.uuid({ error: "El identificador no es válido." }) },
  { error: "Falta la página." },
);

/** Guarda la presentación de una página y purga su página pública de la caché. */
export function updatePageSettings(deps: { pages: PageWriter; cache: PageCache }) {
  return async (raw: unknown): UseCaseResult<Page> => {
    const target = validate(PageIdSchema, raw);
    if (!target.ok) return target;
    const settings = parsePageSettings(raw);
    if (!settings.ok) return settings;

    const updated = await deps.pages.updatePageSettings(target.value.pageId, settings.value);
    if (updated.ok) await deps.cache.purgeProfile(updated.value.handle);
    return updated;
  };
}
