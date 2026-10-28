import type { Result } from "@/domain/result";

// Contenido destacado de un canal (SPEC-live-status, historia 4). Hoy solo
// YouTube; el refresco (tarea 25b) depende de esta interfaz, no del adaptador.

export type FeaturedKind = "video" | "short" | "stream";

export interface FeaturedVideo {
  /** ID de 11 caracteres: la miniatura sale de `i.ytimg.com` con él. */
  readonly videoId: string;
  readonly kind: FeaturedKind;
  readonly title: string;
  readonly publishedAt: string;
  readonly durationSeconds: number | null;
}

/**
 * Errores del proveedor. `quota_exceeded` y `rate_limited` piden esperar
 * (backoff); `budget_exhausted` es el presupuesto propio, antes de gastar cuota.
 */
export type ProviderError =
  "quota_exceeded" | "rate_limited" | "budget_exhausted" | "unavailable" | "invalid_response";

export interface FeaturedContentProvider {
  /** `@handle` o ID `UC…` → ID del canal; `null` si el canal no existe. */
  resolveChannel(handle: string): Promise<Result<string | null, ProviderError>>;
  /** Lo último de ese tipo; `null` si el canal no tiene ninguno. */
  latest(
    channelId: string,
    kind: FeaturedKind,
  ): Promise<Result<FeaturedVideo | null, ProviderError>>;
  /** Un video fijado; `null` si no existe o es privado. */
  video(videoId: string): Promise<Result<FeaturedVideo | null, ProviderError>>;
}

/** Presupuesto diario de cuota: cada llamada pide sus unidades antes de salir. */
export interface QuotaBudget {
  tryConsume(units: number): Promise<boolean>;
}
