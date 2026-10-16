import type { Section, SectionWriter } from "@/application/ports/link-repository";
import { parseTarget } from "@/application/shared/target";
import { changesOf, type UseCaseResult } from "@/application/shared/use-case";
import { parseSectionPatch } from "@/domain/section";

/** `{ id, version, changes }`: renombrar, ocultar o mostrar el título. */
export function updateSection(deps: { sections: SectionWriter }) {
  return async (raw: unknown): UseCaseResult<Section> => {
    const target = parseTarget(raw);
    if (!target.ok) return target;
    const patch = parseSectionPatch(changesOf(raw));
    if (!patch.ok) return patch;
    return deps.sections.updateSection(target.value.id, target.value.version, patch.value);
  };
}
