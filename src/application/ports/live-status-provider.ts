import type { ProviderError } from "@/application/ports/featured-content-provider";
import type { Result } from "@/domain/result";

// Estado en vivo de los canales vigilados (SPEC-live-status, historia 2). Una
// sola interfaz para todos los proveedores: sumar Kick es una carpeta nueva que
// la implementa, y todos pasan la misma suite de contrato.

export interface LiveState {
  readonly isLive: boolean;
  /** Solo si está en vivo. */
  readonly title: string | null;
  readonly startedAt: string | null;
  /** Adónde lleva el aviso "En vivo" (el canal o el directo). */
  readonly url: string | null;
}

export const OFFLINE: LiveState = { isLive: false, title: null, startedAt: null, url: null };

export interface LiveStatusProvider {
  /**
   * El estado de cada canal, por la misma clave con que se pidió (login de
   * Twitch o ID `UC…` de YouTube). Un canal que no existe vuelve como offline.
   * Un error del proveedor es para todo el lote: no se sabe nada.
   */
  checkLive(
    channels: readonly string[],
  ): Promise<Result<ReadonlyMap<string, LiveState>, ProviderError>>;
}
