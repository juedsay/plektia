import type { FeaturedVideo } from "@/application/ports/featured-content-provider";
import type { FeaturedMode } from "@/domain/link-media";

// Lo que el refresco del contenido destacado lee y escribe en la base
// (SPEC-live-status). Lo implementa el cliente de ingesta, con la clave de
// servicio y solo a través de funciones `ingest_*`.

/** Un link de YouTube que destaca algo, con su canal y lo último guardado. */
export interface FeaturedTarget {
  readonly linkId: string;
  /** `@handle` o ID `UC…` del link. */
  readonly handle: string;
  readonly mode: Exclude<FeaturedMode, "none">;
  readonly pinnedVideoId: string | null;
  /** `null` si el canal todavía no se resolvió (o no existe). */
  readonly channelId: string | null;
  /** Cuándo se intentó resolver el canal por última vez. */
  readonly channelCheckedAt: string | null;
  readonly currentVideoId: string | null;
  readonly fetchedAt: string | null;
}

export interface FeaturedStore {
  /** Toma el lock del trabajo; `false` si otra corrida lo tiene. */
  tryLock(job: string, seconds: number): Promise<boolean>;
  releaseLock(job: string): Promise<void>;
  targets(): Promise<readonly FeaturedTarget[]>;
  /** Guarda el canal resuelto (o `null` y el error, para no reintentar enseguida). */
  saveChannel(handle: string, channelId: string | null, error: string | null): Promise<void>;
  /** Devuelve el handle de la página si cambió algo visible (para purgar). */
  saveFeatured(linkId: string, video: FeaturedVideo): Promise<string | null>;
  /** Saca lo destacado; devuelve el handle de la página si había algo. */
  clearFeatured(linkId: string): Promise<string | null>;
}
