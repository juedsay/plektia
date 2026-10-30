import type { Theme } from "@/domain/theme";
import type { Handle } from "@/domain/handle";
import type { LinkHighlight, LinkKind, LinkPlacement } from "@/domain/link";
import type { Accent, ColorMode, LinkShape, NameFont } from "@/domain/page";
import type { Provider } from "@/domain/provider";

// Modelo de lectura de la página pública: solo lo visible y en orden. Es lo que
// consume `public-page` (y nada más: ni dueño, ni versiones, ni email).

/** Lo que un link de YouTube destaca debajo (SPEC-live-status, historia 4). */
export interface PublicFeatured {
  readonly videoId: string;
  readonly kind: "video" | "short" | "stream";
  readonly title: string;
  readonly publishedAt: string;
  readonly durationSeconds: number | null;
  /** `pinned` si el dueño lo fijó; si no, el último de su tipo. */
  readonly pinned: boolean;
}

/** El directo en curso de un canal vigilado (con la regla de los 25 minutos ya aplicada). */
export interface PublicLive {
  readonly title: string | null;
  readonly startedAt: string | null;
}

export interface PublicLink {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly description: string | null;
  readonly provider: Provider;
  readonly providerHandle: string | null;
  /** Solo en links de canales de YouTube con algo para destacar. */
  /** En la lista, como ícono en la fila bajo la bio o en los dos lugares (36d). */
  readonly placement: LinkPlacement;
  /** Con el acento en su lugar, o arriba de todo en tarjeta (36e). */
  readonly highlight: LinkHighlight;
  /** El elegido por el dueño, o `null` (se deduce de la URL al mostrarlo). */
  readonly kind: LinkKind | null;
  /** La imagen de la vista previa de un artículo (`{dueño}/{uuid}.webp`), o `null`. */
  readonly previewImagePath: string | null;
  readonly featured?: PublicFeatured | null;
  /** Solo si el dueño marcó "Transmito en este canal" y está en vivo. */
  readonly live?: PublicLive | null;
}

export interface PublicSection {
  readonly id: string;
  readonly title: string;
  readonly showTitle: boolean;
  /** El rótulo del dueño en lugar del automático ("Lado A", "L1"…), o `null`. */
  readonly label: string | null;
  readonly links: readonly PublicLink[];
}

export interface PublicPage {
  readonly handle: string;
  readonly displayName: string;
  /** Si el encabezado muestra el `@handle` (el dueño puede ocultarlo). */
  readonly showHandle: boolean;
  readonly bio: string | null;
  readonly avatarPath: string | null;
  readonly theme: Theme;
  readonly colorMode: ColorMode;
  readonly accent: Accent;
  readonly linkShape: LinkShape;
  readonly nameFont: NameFont;
  readonly sections: readonly PublicSection[];
  readonly unsectionedLinks: readonly PublicLink[];
}

export interface PublicPageReader {
  /** La página de un handle, o `null` si no existe o el perfil está dado de baja. */
  getByHandle(handle: Handle): Promise<PublicPage | null>;
}

export interface PublicProfileDirectory {
  /** Handles de los perfiles activos, para el sitemap. */
  listHandles(): Promise<string[]>;
}
