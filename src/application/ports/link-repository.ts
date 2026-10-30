import type { LinkDraft, LinkHighlight, LinkKind, LinkPatch, LinkPlacement } from "@/domain/link";
import type { Provider } from "@/domain/provider";
import type { Result } from "@/domain/result";
import type { SectionDraft, SectionPatch } from "@/domain/section";

// Puertos de secciones y links (SPEC-links, "Código"). Lectura y escritura van
// separadas (ISP): la página pública solo necesita leer. El dueño nunca es un
// parámetro: sale de la sesión, y la base lo fija con `auth.uid()` y lo exige
// con RLS, así que ningún caso de uso puede escribir a nombre de otro.

export interface Link {
  readonly id: string;
  readonly sectionId: string | null;
  readonly title: string;
  readonly url: string;
  readonly description: string | null;
  readonly provider: Provider;
  readonly providerHandle: string | null;
  readonly tags: readonly string[];
  readonly visible: boolean;
  /** En la lista, como ícono en la fila bajo la bio o en los dos lugares. */
  readonly placement: LinkPlacement;
  /** Sin destacar, con el acento en su lugar o arriba de todo. */
  readonly highlight: LinkHighlight;
  /** Red social, artículo, video o sitio; `null` es automático (por la URL). */
  readonly kind: LinkKind | null;
  /** La imagen de la vista previa de un artículo (`{dueño}/{uuid}.webp`), o `null`. */
  readonly previewImagePath: string | null;
  readonly position: number;
  readonly version: number;
}

export interface Section {
  readonly id: string;
  readonly title: string;
  readonly showTitle: boolean;
  /** El rótulo que reemplaza al automático ("Lado A", "L1"…); `null` es el automático. */
  readonly label: string | null;
  readonly visible: boolean;
  readonly position: number;
  readonly version: number;
}

/** Elemento de una lista de orden: el id y la versión leída (concurrencia optimista). */
export interface Versioned {
  readonly id: string;
  readonly version: number;
}

export type WriteError = "not_found" | "conflict" | "limit_reached" | "invalid_input" | "forbidden";

export interface OwnLinks {
  readonly sections: readonly Section[];
  readonly links: readonly Link[];
}

export interface LinkReader {
  /** Todas las secciones y links del usuario de la sesión, en orden. */
  listOwn(): Promise<OwnLinks>;
}

export interface LinkWriter {
  /**
   * Con `id`, el alta es idempotente: si ya existe un link propio con ese id, lo
   * devuelve sin crear otro (el mismo pedido, repetido).
   */
  createLink(draft: LinkDraft, id?: string): Promise<Result<Link, WriteError>>;
  updateLink(id: string, version: number, patch: LinkPatch): Promise<Result<Link, WriteError>>;
  deleteLink(id: string, version: number): Promise<Result<void, WriteError>>;
  /** `items` es el orden final completo del grupo destino (una sección o "Sin sección"). */
  moveLinks(
    sectionId: string | null,
    items: readonly Versioned[],
  ): Promise<Result<void, WriteError>>;
}

export interface SectionWriter {
  /** Con `id`, idempotente, como `createLink`. */
  createSection(draft: SectionDraft, id?: string): Promise<Result<Section, WriteError>>;
  updateSection(
    id: string,
    version: number,
    patch: SectionPatch,
  ): Promise<Result<Section, WriteError>>;
  /** Sus links pasan al final de "Sin sección". */
  deleteSection(id: string, version: number): Promise<Result<void, WriteError>>;
  /** `items` es el orden final completo de las secciones del usuario. */
  reorderSections(items: readonly Versioned[]): Promise<Result<void, WriteError>>;
}
