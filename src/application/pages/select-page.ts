import { z } from "zod";

import type { PageWriter } from "@/application/ports/page-repository";
import type { UseCaseResult } from "@/application/shared/use-case";
import { validate } from "@/domain/text";

const SelectPageSchema = z.object(
  { pageId: z.uuid({ error: "El identificador no es válido." }) },
  { error: "Falta la página." },
);

/** Elegir una página la deja como la última usada (SPEC-pages, "Al entrar"). */
export function selectPage(deps: { pages: PageWriter }) {
  return async (raw: unknown): UseCaseResult<void> => {
    const command = validate(SelectPageSchema, raw);
    if (!command.ok) return command;
    return deps.pages.rememberLastPage(command.value.pageId);
  };
}
