import type { OwnLinks } from "@/application/ports/link-repository";

// Resumen de una página para el inicio del panel: cada grupo (sección o "Sin
// sección") con cuántos links tiene y cuántos están ocultos.

export interface GroupSummary {
  readonly title: string;
  readonly visible: boolean;
  readonly linkCount: number;
  readonly hiddenCount: number;
}

export interface PageSummary {
  readonly groups: readonly GroupSummary[];
  readonly linkCount: number;
}

export function summarizePage({ sections, links }: OwnLinks): PageSummary {
  const countIn = (sectionId: string | null) => {
    const inGroup = links.filter((link) => link.sectionId === sectionId);
    return {
      linkCount: inGroup.length,
      hiddenCount: inGroup.filter((link) => !link.visible).length,
    };
  };
  const groups: GroupSummary[] = sections.map((section) => ({
    title: section.title,
    visible: section.visible,
    ...countIn(section.id),
  }));
  const unsectioned = countIn(null);
  if (unsectioned.linkCount > 0)
    groups.push({ title: "Sin sección", visible: true, ...unsectioned });
  return { groups, linkCount: links.length };
}

/** "1 link", "3 links"; con los ocultos aparte: "3 links, 1 oculto". */
export function describeCount(linkCount: number, hiddenCount: number): string {
  const links = linkCount === 1 ? "1 link" : `${String(linkCount)} links`;
  if (hiddenCount === 0) return links;
  const hidden = hiddenCount === 1 ? "1 oculto" : `${String(hiddenCount)} ocultos`;
  return `${links}, ${hidden}`;
}
