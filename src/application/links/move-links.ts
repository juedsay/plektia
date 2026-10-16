import { z } from "zod";

import type { LinkWriter } from "@/application/ports/link-repository";
import { parseOrder, SectionIdOrNull } from "@/application/shared/target";
import type { UseCaseResult } from "@/application/shared/use-case";
import { invalidInput } from "@/domain/errors";
import { err } from "@/domain/result";

const Destination = z.object({ sectionId: SectionIdOrNull });

/**
 * `{ sectionId, items }`: deja el grupo destino (una sección, o "Sin sección"
 * con `null`) en el orden de `items`, trayendo los links que vengan de otros
 * grupos. La base valida que la lista sea completa y que todo sea del usuario.
 */
export function moveLinks(deps: { links: LinkWriter }) {
  return async (raw: unknown): UseCaseResult<void> => {
    const destination = Destination.safeParse(raw);
    if (!destination.success) {
      return err(invalidInput({ sectionId: "La sección no es válida." }));
    }
    const order = parseOrder(raw);
    if (!order.ok) return order;
    return deps.links.moveLinks(destination.data.sectionId, order.value.items);
  };
}
