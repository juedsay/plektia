import type { Link, OwnLinks, Section } from "@/application/ports/link-repository";
import { socialProfileFor } from "@/ui/view/social-profile";

// Estado del editor de links (SPEC-admin-panel, "Editor"): lógica pura, sin
// DOM, para que la isla solo dibuje y los tests la cubran sin navegador.

export interface LinkGroup {
  /** `null` es "Sin sección". */
  readonly section: Section | null;
  readonly links: readonly Link[];
}

/** Los grupos en el orden de la página pública: las secciones y, al final, "Sin sección". */
export function groupLinks({ sections, links }: OwnLinks): LinkGroup[] {
  const byPosition = (first: Link, second: Link) => first.position - second.position;
  const groups: LinkGroup[] = [...sections]
    .sort((first, second) => first.position - second.position)
    .map((section) => ({
      section,
      links: links.filter((link) => link.sectionId === section.id).sort(byPosition),
    }));
  const unsectioned = links.filter((link) => link.sectionId === null).sort(byPosition);
  if (unsectioned.length > 0 || sections.length === 0) {
    groups.push({ section: null, links: unsectioned });
  }
  return groups;
}

/** Reemplaza un link por su versión nueva (la que devolvió el servidor). */
export function replaceLink(content: OwnLinks, updated: Link): OwnLinks {
  return {
    ...content,
    links: content.links.map((link) => (link.id === updated.id ? updated : link)),
  };
}

export function addLink(content: OwnLinks, created: Link): OwnLinks {
  return { ...content, links: [...content.links, created] };
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
