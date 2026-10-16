import type { SectionWriter } from "@/application/ports/link-repository";
import { parseOrder } from "@/application/shared/target";
import type { UseCaseResult } from "@/application/shared/use-case";

/** `{ items }`: el orden final completo de las secciones del usuario. */
export function reorderSections(deps: { sections: SectionWriter }) {
  return async (raw: unknown): UseCaseResult<void> => {
    const order = parseOrder(raw);
    if (!order.ok) return order;
    return deps.sections.reorderSections(order.value.items);
  };
}
