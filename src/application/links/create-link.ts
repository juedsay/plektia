import type { Link, LinkWriter } from "@/application/ports/link-repository";
import { requestIdOf } from "@/application/shared/request-id";
import type { UseCaseResult } from "@/application/shared/use-case";
import { parseLinkInput } from "@/domain/link";

export function createLink(deps: { links: LinkWriter }) {
  return async (raw: unknown): UseCaseResult<Link> => {
    const draft = parseLinkInput(raw);
    if (!draft.ok) return draft;
    const id = requestIdOf(raw);
    if (!id.ok) return id;
    return deps.links.createLink(draft.value, id.value);
  };
}
