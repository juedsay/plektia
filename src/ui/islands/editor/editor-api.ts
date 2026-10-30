import type { FormResult } from "@/actions/form-result";
import type { LinkMediaView } from "@/application/ports/link-media-repository";
import type { Link, OwnLinks, Section } from "@/application/ports/link-repository";
import { errorMessage } from "@/domain/errors";
import type { LinkHighlight, LinkKind, LinkPlacement } from "@/domain/link-presentation";
import type { FeaturedMode, LinkMedia } from "@/domain/link-media";

// Lo que el editor le pide al servidor. En el navegador son las Actions de
// links (Editor.tsx); en los tests de componentes, un servidor falso.

export interface NewLink {
  /** Id del alta (UUID): repetir el pedido devuelve el mismo link, no otro. */
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly sectionId: string | null;
  /** `null` (o sin él): automático, se deduce de la URL. */
  readonly kind?: LinkKind | null;
  /** Opcional; la propone "Traer vista previa" en un artículo. */
  readonly description?: string | null;
}

/** Lo que propone "Traer vista previa" (SPEC-link-form, 7c). */
export interface PreviewSuggestion {
  readonly title: string | null;
  readonly description: string | null;
  /** La imagen que declara el artículo (se trae aparte, con `fetchPreviewImage`). */
  readonly imageUrl?: string | null;
}

export interface LinkChanges {
  readonly title?: string;
  readonly url?: string;
  readonly description?: string | null;
  /** Solo para "Deshacer" un mostrar u ocultar. */
  readonly visible?: boolean;
  /** En la lista, como ícono o en los dos lugares (36d). */
  readonly placement?: LinkPlacement;
  /** Sin destacar, con el acento o arriba de todo (36e). */
  readonly highlight?: LinkHighlight;
  /** Red social, artículo, video o sitio; `null` vuelve a automático (37b). */
  readonly kind?: LinkKind | null;
}

export interface EditorApi {
  list(): Promise<OwnLinks | null>;
  create(link: NewLink): Promise<FormResult<Link>>;
  update(target: { id: string; version: number }, changes: LinkChanges): Promise<FormResult<Link>>;
  setVisibility(
    target: { id: string; version: number },
    visible: boolean,
  ): Promise<FormResult<Link>>;
  delete(target: { id: string; version: number }): Promise<FormResult<void>>;
  /** Borra al cerrar la pestaña: el pedido sigue aunque la página se descargue. */
  deleteOnExit(target: { id: string; version: number }): void;
  /** Deja un grupo en ese orden (trayendo links de otros); devuelve el contenido nuevo. */
  move(
    sectionId: string | null,
    order: readonly { id: string; version: number }[],
  ): Promise<FormResult<OwnLinks>>;
  reorderSections(order: readonly { id: string; version: number }[]): Promise<FormResult<OwnLinks>>;
  /** `id`: como en `NewLink`, repetir el pedido devuelve la misma sección. */
  createSection(title: string, id: string): Promise<FormResult<Section>>;
  updateSection(
    target: { id: string; version: number },
    changes: SectionChanges,
  ): Promise<FormResult<Section>>;
  /** Borra la sección (sus links pasan a "Sin sección"); devuelve el contenido nuevo. */
  deleteSection(target: { id: string; version: number }): Promise<FormResult<OwnLinks>>;
  /** Como `deleteOnExit`, para una sección. */
  deleteSectionOnExit(target: { id: string; version: number }): void;
  /** "Transmito en este canal" y el contenido destacado de un link de canal. */
  getMedia(linkId: string): Promise<FormResult<LinkMediaView>>;
  /** Guarda la configuración completa (repetirla deja lo mismo). */
  setMedia(linkId: string, settings: MediaChoice): Promise<FormResult<LinkMedia>>;
  /** El título y la descripción de un artículo; no guarda nada. */
  fetchPreview(url: string): Promise<FormResult<PreviewSuggestion>>;
  /** La imagen del artículo como `data:` URL, para re-codificarla acá (7c-2). */
  fetchPreviewImage(url: string): Promise<FormResult<{ readonly dataUrl: string }>>;
  /** Guarda la imagen ya re-codificada (480 × 252) en el link. */
  setPreviewImage(target: { id: string; version: number }, image: Blob): Promise<FormResult<Link>>;
  /** Si una app conectada por MCP cambió el link en la última hora (para el conflicto). */
  lastAppEdit(
    linkId: string,
  ): Promise<{ readonly appName: string; readonly editedAt: string } | null>;
  /** Saca la imagen del link y borra el archivo. */
  removePreviewImage(target: { id: string; version: number }): Promise<FormResult<Link>>;
}

export interface MediaChoice {
  readonly watchLive: boolean;
  readonly featuredMode: FeaturedMode;
  /** La URL o el ID que pegó el dueño, solo con "Fijado". */
  readonly pinnedVideo: string | null;
}

export interface SectionChanges {
  readonly title?: string;
  readonly showTitle?: boolean;
  readonly visible?: boolean;
  /** `null` vuelve al rótulo automático del estilo. */
  readonly label?: string | null;
}

/** Un resultado que salió mal: el mensaje general y el de cada campo. */
export type Failure = Extract<FormResult<never>, { ok: false }>;

/** Un fallo de red o del servidor, con el mismo formato que un error esperable. */
export const UNREACHABLE: FormResult<never> = {
  ok: false,
  message: "No pudimos guardar: revisá tu conexión y probá de nuevo.",
  fields: {},
  values: {},
};

/** Si el error es de versión ("otro lo cambió"): se ofrece recargar ese link. */
export const CONFLICT_MESSAGE = errorMessage("conflict");
