import type { WriteError } from "@/application/ports/link-repository";
import type { LinkMedia } from "@/domain/link-media";
import type { Provider } from "@/domain/provider";
import type { Result } from "@/domain/result";

// Configuración de medios de los links de una página (SPEC-live-status). Como
// en los links, el dueño sale de la sesión y la base lo exige con RLS.

/** Un link con su configuración (la predeterminada si nunca se guardó). */
export interface LinkMediaView {
  readonly linkId: string;
  readonly provider: Provider;
  readonly providerHandle: string | null;
  readonly media: LinkMedia;
}

export interface LinkMediaRepository {
  /** `null` si el link no existe en la página. */
  read(linkId: string): Promise<LinkMediaView | null>;
  /** Reemplaza la configuración completa (repetirlo deja lo mismo). */
  save(linkId: string, media: LinkMedia): Promise<Result<LinkMedia, WriteError>>;
}
