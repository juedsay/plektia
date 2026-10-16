import type { Link, LinkWriter } from "@/application/ports/link-repository";
import type { UseCaseResult } from "@/application/shared/use-case";
import { parseLinkInput } from "@/domain/link";

export function createLink(deps: { links: LinkWriter }) {
  return async (raw: unknown): UseCaseResult<Link> => {
    const draft = parseLinkInput(raw);
    if (!draft.ok) return draft;
    return deps.links.createLink(draft.value);
  };
}
