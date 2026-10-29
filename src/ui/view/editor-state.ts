import type { LinkHighlight, LinkPlacement } from "@/domain/link-presentation";
import type { Link, OwnLinks, Section } from "@/application/ports/link-repository";
import { socialProfileFor } from "@/ui/view/social-profile";

// Estado del editor de links (SPEC-admin-panel, "Editor"): lógica pura, sin
// DOM, para que la isla solo dibuje y los tests la cubran sin navegador.

export interface LinkGroup {
  /** `null` es "Sin sección". */
  readonly section: Section | null;
  readonly links: readonly Link[];
}

/** Los grupos en el orden de la página pública: las secciones y, al final, "Sin sección" (siempre). */
export function groupLinks({ sections, links }: OwnLinks): LinkGroup[] {
  const byPosition = (first: Link, second: Link) => first.position - second.position;
  const groups: LinkGroup[] = [...sections]
    .sort((first, second) => first.position - second.position)
    .map((section) => ({
      section,
      links: links.filter((link) => link.sectionId === section.id).sort(byPosition),
    }));
  // "Sin sección" está siempre, aunque esté vacía: es donde se suelta un link
  // para sacarlo de su sección.
  groups.push({
    section: null,
    links: links.filter((link) => link.sectionId === null).sort(byPosition),
  });
  return groups;
}

/** Reemplaza un link por su versión nueva (la que devolvió el servidor). */
export function replaceLink(content: OwnLinks, updated: Link): OwnLinks {
  return {
    ...content,
    links: content.links.map((link) => (link.id === updated.id ? updated : link)),
  };
}

/** Suma un link; si ya estaba (el servidor devolvió un alta repetida), no lo duplica. */
export function addLink(content: OwnLinks, created: Link): OwnLinks {
  return {
    ...content,
    links: [...content.links.filter((link) => link.id !== created.id), created],
  };
}

/** Suma una sección al final; si ya estaba, no la duplica. */
export function addSection(content: OwnLinks, created: Section): OwnLinks {
  return {
    ...content,
    sections: [...content.sections.filter((section) => section.id !== created.id), created],
  };
}

/**
 * Título propuesto para una URL recién pegada: el nombre de la red ("Instagram")
 * o el sitio sin "www." ("jsimon.vercel.app"). Vacío si la URL no se entiende.
 * No se pide nada a la URL: el título sale de la URL misma (sin SSRF).
 */
export function suggestTitle(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const social = socialProfileFor(trimmed);
  if (social) return social.label;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "mailto:") return "Email";
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Lo que cambió entre lo guardado y lo que hay en el formulario (para no mandar de más). */
export function changedFields(
  link: Link,
  edited: { title: string; url: string; description: string },
): Partial<{ title: string; url: string; description: string | null }> {
  const changes: Partial<{ title: string; url: string; description: string | null }> = {};
  if (edited.title.trim() !== link.title) changes.title = edited.title;
  if (edited.url.trim() !== link.url) changes.url = edited.url;
  const description = edited.description.trim();
  if (description !== (link.description ?? "")) changes.description = description || null;
  return changes;
}

/** Si aplicar estos cambios deja la sección igual (por ejemplo, ocultar una ya oculta). */
export function changesNothing(
  section: Section,
  changes: { title?: string; showTitle?: boolean; visible?: boolean },
): boolean {
  return (
    (changes.title === undefined || changes.title.trim() === section.title) &&
    (changes.showTitle === undefined || changes.showTitle === section.showTitle) &&
    (changes.visible === undefined || changes.visible === section.visible)
  );
}

export function removeLink(content: OwnLinks, id: string): OwnLinks {
  return { ...content, links: content.links.filter((link) => link.id !== id) };
}

/**
 * Lo que hay que mandar para volver un link a como estaba antes de un cambio
 * ("Deshacer"): solo los campos que cambiaron, con sus valores anteriores.
 */
export function inverseChanges(
  before: Link,
  after: Link,
): Partial<{
  title: string;
  url: string;
  description: string | null;
  visible: boolean;
  placement: LinkPlacement;
  highlight: LinkHighlight;
}> {
  const changes: Partial<{
    title: string;
    url: string;
    description: string | null;
    visible: boolean;
    placement: LinkPlacement;
    highlight: LinkHighlight;
  }> = {};
  if (before.title !== after.title) changes.title = before.title;
  if (before.url !== after.url) changes.url = before.url;
  if (before.description !== after.description) changes.description = before.description;
  if (before.visible !== after.visible) changes.visible = before.visible;
  if (before.placement !== after.placement) changes.placement = before.placement;
  if (before.highlight !== after.highlight) changes.highlight = before.highlight;
  return changes;
}

/** Lo que espera la base para ordenar un grupo: su orden final completo. */
export interface OrderedItem {
  readonly id: string;
  readonly version: number;
}

export interface LinkMovePlan {
  /** Cómo queda el editor mientras el servidor confirma (optimista). */
  readonly content: OwnLinks;
  /** El grupo destino: una sección o `null` ("Sin sección"). */
  readonly sectionId: string | null;
  readonly order: readonly OrderedItem[];
}

/**
 * Mover un link a `toIndex` dentro de `toSectionId` (puede ser el mismo grupo).
 * El grupo de origen queda compacto, como lo deja la base. `null` si el link no
 * existe o no cambia de lugar.
 */
export function planLinkMove(
  content: OwnLinks,
  linkId: string,
  toSectionId: string | null,
  toIndex: number,
): LinkMovePlan | null {
  const moved = content.links.find((link) => link.id === linkId);
  if (!moved) return null;
  const byPosition = (first: Link, second: Link) => first.position - second.position;
  const destination = content.links
    .filter((link) => link.sectionId === toSectionId && link.id !== linkId)
    .sort(byPosition);
  const index = Math.max(0, Math.min(toIndex, destination.length));
  const current = content.links
    .filter((link) => link.sectionId === moved.sectionId)
    .sort(byPosition)
    .findIndex((link) => link.id === linkId);
  if (moved.sectionId === toSectionId && current === index) return null;

  destination.splice(index, 0, { ...moved, sectionId: toSectionId });
  const placed = new Map(
    destination.map((link, position) => [link.id, { ...link, sectionId: toSectionId, position }]),
  );
  const source = content.links
    .filter((link) => link.sectionId === moved.sectionId && link.id !== linkId)
    .sort(byPosition);
  const compacted = new Map(
    moved.sectionId === toSectionId
      ? []
      : source.map((link, position) => [link.id, { ...link, position }]),
  );
  return {
    content: {
      ...content,
      links: content.links.map((link) => placed.get(link.id) ?? compacted.get(link.id) ?? link),
    },
    sectionId: toSectionId,
    order: destination.map((link) => ({ id: link.id, version: link.version })),
  };
}

export interface SectionMovePlan {
  readonly content: OwnLinks;
  readonly order: readonly OrderedItem[];
}

/** Mover una sección a `toIndex`. `null` si no existe o no cambia de lugar. */
export function planSectionMove(
  content: OwnLinks,
  sectionId: string,
  toIndex: number,
): SectionMovePlan | null {
  const sorted = [...content.sections].sort((first, second) => first.position - second.position);
  const current = sorted.findIndex((section) => section.id === sectionId);
  if (current === -1) return null;
  const index = Math.max(0, Math.min(toIndex, sorted.length - 1));
  if (current === index) return null;
  const [moved] = sorted.splice(current, 1);
  if (!moved) return null;
  sorted.splice(index, 0, moved);
  return {
    content: {
      ...content,
      sections: sorted.map((section, position) => ({ ...section, position })),
    },
    order: sorted.map((section) => ({ id: section.id, version: section.version })),
  };
}

/** Clave del grupo "Sin sección" (los links con `section_id` nulo). */
export const UNSECTIONED_GROUP = "sin-seccion";

/** Los ids de los links de cada grupo, en orden: lo que se reordena mientras se arrastra. */
export type LinkOrder = Record<string, string[]>;

export function linkOrderOf(content: OwnLinks): LinkOrder {
  const order: LinkOrder = {};
  for (const group of groupLinks(content)) {
    order[group.section?.id ?? UNSECTIONED_GROUP] = group.links.map((link) => link.id);
  }
  return order;
}

/** Los grupos con los links en el orden del arrastre en curso (si lo hay). */
export function applyLinkOrder(groups: readonly LinkGroup[], order: LinkOrder | null): LinkGroup[] {
  if (!order) return [...groups];
  const linksById = new Map(groups.flatMap((group) => group.links).map((link) => [link.id, link]));
  return groups.map((group) => ({
    ...group,
    links: (order[group.section?.id ?? UNSECTIONED_GROUP] ?? [])
      .map((id) => linksById.get(id))
      .filter((link): link is Link => link !== undefined),
  }));
}

/** Dónde quedó un link en el orden del arrastre: su grupo y su posición. */
export function placeInOrder(
  order: LinkOrder,
  linkId: string,
): { sectionId: string | null; index: number } | null {
  for (const [groupKey, ids] of Object.entries(order)) {
    const index = ids.indexOf(linkId);
    if (index !== -1) {
      return { sectionId: groupKey === UNSECTIONED_GROUP ? null : groupKey, index };
    }
  }
  return null;
}

/**
 * Cómo queda la página al borrar una sección, como lo hace la base: la sección
 * se va y sus links pasan al final de "Sin sección", en su orden.
 */
export function removeSection(content: OwnLinks, sectionId: string): OwnLinks {
  const byPosition = (first: Link, second: Link) => first.position - second.position;
  const unsectionedCount = content.links.filter((link) => link.sectionId === null).length;
  const orphans = content.links
    .filter((link) => link.sectionId === sectionId)
    .sort(byPosition)
    .map((link, offset) => ({ ...link, sectionId: null, position: unsectionedCount + offset }));
  const orphanById = new Map(orphans.map((link) => [link.id, link]));
  return {
    sections: content.sections.filter((section) => section.id !== sectionId),
    links: content.links.map((link) => orphanById.get(link.id) ?? link),
  };
}

/**
 * Deshace `removeSection` sobre el contenido de ahora (no sobre la foto vieja):
 * la sección vuelve a su lugar y recupera los links que tenía y que siguen en
 * "Sin sección". Lo que se cambió mientras tanto se mantiene.
 */
export function restoreSection(content: OwnLinks, before: OwnLinks, sectionId: string): OwnLinks {
  const section = before.sections.find((candidate) => candidate.id === sectionId);
  if (!section || content.sections.some((candidate) => candidate.id === sectionId)) return content;
  const formerLinks = new Map(
    before.links.filter((link) => link.sectionId === sectionId).map((link) => [link.id, link]),
  );
  const sections = [...content.sections];
  sections.splice(before.sections.indexOf(section), 0, section);
  return {
    sections,
    links: content.links.map((link) => {
      const former = formerLinks.get(link.id);
      return former && link.sectionId === null
        ? { ...link, sectionId, position: former.position }
        : link;
    }),
  };
}

export function replaceSection(content: OwnLinks, updated: Section): OwnLinks {
  return {
    ...content,
    sections: content.sections.map((section) => (section.id === updated.id ? updated : section)),
  };
}
