import type { LiveState } from "@/application/ports/live-status-provider";

// Lo que el refresco del estado en vivo lee y escribe en la base
// (SPEC-live-status). Lo implementa el cliente de ingesta, con la clave de
// servicio y solo a través de funciones `ingest_*`.

export type LiveProvider = "youtube" | "twitch";

/** Un canal vigilado ("Transmito en este canal"), uno por proveedor y handle. */
export interface LiveTarget {
  readonly provider: LiveProvider;
  /** Login de Twitch, o `@handle` / ID `UC…` de YouTube. */
  readonly handle: string;
  /** Solo YouTube: el ID `UC…` si ya se resolvió. */
  readonly channelId: string | null;
  readonly channelCheckedAt: string | null;
}

export interface LiveStore {
  tryLock(job: string, seconds: number): Promise<boolean>;
  releaseLock(job: string): Promise<void>;
  targets(): Promise<readonly LiveTarget[]>;
  /** Guarda el canal de YouTube resuelto (o `null` si no existe). */
  saveChannel(handle: string, channelId: string | null, error: string | null): Promise<void>;
  /** Guarda el estado; devuelve las páginas a purgar si cambió algo visible. */
  saveLive(provider: LiveProvider, handle: string, state: LiveState): Promise<readonly string[]>;
}
