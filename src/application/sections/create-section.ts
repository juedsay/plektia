import type { Section, SectionWriter } from "@/application/ports/link-repository";
import { requestIdOf } from "@/application/shared/request-id";
import type { UseCaseResult } from "@/application/shared/use-case";
import { parseSectionInput } from "@/domain/section";

export function createSection(deps: { sections: SectionWriter }) {
  return async (raw: unknown): UseCaseResult<Section> => {
    const draft = parseSectionInput(raw);
    if (!draft.ok) return draft;
    const id = requestIdOf(raw);
    if (!id.ok) return id;
    return deps.sections.createSection(draft.value, id.value);
  };
}
