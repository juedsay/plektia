import type {
  Link,
  LinkReader,
  LinkWriter,
  OwnLinks,
  Section,
  SectionWriter,
  Versioned,
  WriteError,
} from "@/application/ports/link-repository";
import { LIMITS, type LinkDraft, type LinkPatch } from "@/domain/link";
import { err, ok, type Result } from "@/domain/result";
import type { SectionDraft, SectionPatch } from "@/domain/section";

/**
 * Repositorio en memoria para los tests de casos de uso. Imita las reglas de la
 * base que importan a la aplicación: versión optimista, límites, orden por
 * grupo y listas completas. Las garantías reales las prueban pgTAP y los tests
 * de integración contra Supabase.
 */
export class InMemoryLinkRepository implements LinkReader, LinkWriter, SectionWriter {
  links: Link[] = [];
  sections: Section[] = [];
  private nextId = 1;

  private id(): string {
    return `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, "0")}`;
  }

  listOwn(): Promise<OwnLinks> {
    const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;
    return Promise.resolve({
      sections: [...this.sections].sort(byPosition),
      links: [...this.links].sort(byPosition),
    });
  }

  createLink(draft: LinkDraft, id?: string): Promise<Result<Link, WriteError>> {
    const existing = this.links.find((link) => link.id === id);
    if (existing) return Promise.resolve(ok(existing));
    if (this.links.length >= LIMITS.links) return Promise.resolve(err("limit_reached"));
    if (draft.sectionId && !this.sections.some((section) => section.id === draft.sectionId)) {
      return Promise.resolve(err("not_found"));
    }
    const group = this.links.filter((link) => link.sectionId === draft.sectionId);
    const link: Link = {
      ...draft,
      placement: "list",
      highlight: "none",
      previewImagePath: null,
      id: id ?? this.id(),
      position: group.length,
      version: 1,
    };
    this.links.push(link);
    return Promise.resolve(ok(link));
  }

  updateLink(id: string, version: number, patch: LinkPatch): Promise<Result<Link, WriteError>> {
    const index = this.links.findIndex((link) => link.id === id);
    const current = this.links[index];
    if (!current) return Promise.resolve(err("not_found"));
    if (current.version !== version) return Promise.resolve(err("conflict"));
    const updated: Link = { ...current, ...patch, version: current.version + 1 };
    this.links[index] = updated;
    return Promise.resolve(ok(updated));
  }

  deleteLink(id: string, version: number): Promise<Result<void, WriteError>> {
    const current = this.links.find((link) => link.id === id);
    if (!current) return Promise.resolve(err("not_found"));
    if (current.version !== version) return Promise.resolve(err("conflict"));
    this.links = this.links.filter((link) => link.id !== id);
    return Promise.resolve(ok(undefined));
  }

  moveLinks(
    sectionId: string | null,
    items: readonly Versioned[],
  ): Promise<Result<void, WriteError>> {
    const inGroup = this.links.filter((link) => link.sectionId === sectionId);
    const ids = new Set(items.map((item) => item.id));
    if (inGroup.some((link) => !ids.has(link.id))) return Promise.resolve(err("invalid_input"));
    for (const item of items) {
      const link = this.links.find((link) => link.id === item.id);
      if (!link) return Promise.resolve(err("invalid_input"));
      if (link.version !== item.version) return Promise.resolve(err("conflict"));
    }
    items.forEach((item, position) => {
      const index = this.links.findIndex((link) => link.id === item.id);
      const link = this.links[index];
      if (link) this.links[index] = { ...link, sectionId, position, version: link.version + 1 };
    });
    return Promise.resolve(ok(undefined));
  }

  createSection(draft: SectionDraft, id?: string): Promise<Result<Section, WriteError>> {
    const existing = this.sections.find((section) => section.id === id);
    if (existing) return Promise.resolve(ok(existing));
    if (this.sections.length >= LIMITS.sections) return Promise.resolve(err("limit_reached"));
    const section: Section = {
      ...draft,
      label: null,
      id: id ?? this.id(),
      position: this.sections.length,
      version: 1,
    };
    this.sections.push(section);
    return Promise.resolve(ok(section));
  }

  updateSection(
    id: string,
    version: number,
    patch: SectionPatch,
  ): Promise<Result<Section, WriteError>> {
    const index = this.sections.findIndex((section) => section.id === id);
    const current = this.sections[index];
    if (!current) return Promise.resolve(err("not_found"));
    if (current.version !== version) return Promise.resolve(err("conflict"));
    const updated: Section = { ...current, ...patch, version: current.version + 1 };
    this.sections[index] = updated;
    return Promise.resolve(ok(updated));
  }

  deleteSection(id: string, version: number): Promise<Result<void, WriteError>> {
    const current = this.sections.find((section) => section.id === id);
    if (!current) return Promise.resolve(err("not_found"));
    if (current.version !== version) return Promise.resolve(err("conflict"));
    this.sections = this.sections.filter((section) => section.id !== id);
    this.links = this.links.map((link) =>
      link.sectionId === id ? { ...link, sectionId: null } : link,
    );
    return Promise.resolve(ok(undefined));
  }

  reorderSections(items: readonly Versioned[]): Promise<Result<void, WriteError>> {
    if (items.length !== this.sections.length) return Promise.resolve(err("invalid_input"));
    for (const item of items) {
      const section = this.sections.find((section) => section.id === item.id);
      if (!section) return Promise.resolve(err("invalid_input"));
      if (section.version !== item.version) return Promise.resolve(err("conflict"));
    }
    this.sections = items.map((item, position) => {
      const section = this.sections.find((section) => section.id === item.id);
      if (!section) throw new Error("validado arriba");
      return { ...section, position, version: section.version + 1 };
    });
    return Promise.resolve(ok(undefined));
  }
}
