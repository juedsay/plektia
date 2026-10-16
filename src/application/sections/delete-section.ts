import type { SectionWriter } from "@/application/ports/link-repository";
import { parseTarget } from "@/application/shared/target";
import type { UseCaseResult } from "@/application/shared/use-case";

/** Borra una sección; sus links pasan al final de "Sin sección", en su orden. */
export function deleteSection(deps: { sections: SectionWriter }) {
  return async (raw: unknown): UseCaseResult<void> => {
    const target = parseTarget(raw);
    if (!target.ok) return target;
    return deps.sections.deleteSection(target.value.id, target.value.version);
  };
}
