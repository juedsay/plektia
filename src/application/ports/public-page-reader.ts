import type { Handle } from "@/domain/handle";
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

export interface PublicLink {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly description: string | null;
  readonly provider: Provider;
  readonly providerHandle: string | null;
  /** Solo en links de canales de YouTube con algo para destacar. */
  readonly featured?: PublicFeatured | null;
}

export interface PublicSection {
  readonly id: string;
  readonly title: string;
  readonly showTitle: boolean;
  readonly links: readonly PublicLink[];
}

export interface PublicPage {
  readonly handle: string;
  readonly displayName: string;
  /** Si el encabezado muestra el `@handle` (el dueño puede ocultarlo). */
  readonly showHandle: boolean;
  readonly bio: string | null;
  readonly avatarPath: string | null;
  readonly theme: "tecnico";
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
