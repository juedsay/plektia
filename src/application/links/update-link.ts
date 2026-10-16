import type { Link, LinkWriter } from "@/application/ports/link-repository";
import { parseTarget } from "@/application/shared/target";
import { changesOf, type UseCaseResult } from "@/application/shared/use-case";
import { parseLinkPatch } from "@/domain/link";

/** `{ id, version, changes }`: si otro lo cambió desde que se leyó, da `conflict`. */
export function updateLink(deps: { links: LinkWriter }) {
  return async (raw: unknown): UseCaseResult<Link> => {
    const target = parseTarget(raw);
    if (!target.ok) return target;
    const patch = parseLinkPatch(changesOf(raw));
    if (!patch.ok) return patch;
    return deps.links.updateLink(target.value.id, target.value.version, patch.value);
  };
}
