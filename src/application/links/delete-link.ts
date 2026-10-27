import type { LinkWriter } from "@/application/ports/link-repository";
import { alreadyGone } from "@/application/shared/idempotent-delete";
import { parseTarget } from "@/application/shared/target";
import type { UseCaseResult } from "@/application/shared/use-case";

export function deleteLink(deps: { links: LinkWriter }) {
  return async (raw: unknown): UseCaseResult<void> => {
    const target = parseTarget(raw);
    if (!target.ok) return target;
    return alreadyGone(await deps.links.deleteLink(target.value.id, target.value.version));
  };
}
