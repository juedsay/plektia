import type { Link, LinkWriter } from "@/application/ports/link-repository";
import { parseTarget } from "@/application/shared/target";
import type { UseCaseResult } from "@/application/shared/use-case";
import { invalidInput } from "@/domain/errors";
import { err } from "@/domain/result";

/** `{ id, version, visible }`: mostrar u ocultar un link en la página pública. */
export function setLinkVisibility(deps: { links: LinkWriter }) {
  return async (raw: unknown): UseCaseResult<Link> => {
    const target = parseTarget(raw);
    if (!target.ok) return target;
    const visible =
      typeof raw === "object" && raw !== null && "visible" in raw ? raw.visible : undefined;
    if (typeof visible !== "boolean") {
      return err(invalidInput({ visible: "La visibilidad tiene que ser sí o no." }));
    }
    return deps.links.updateLink(target.value.id, target.value.version, { visible });
  };
}
