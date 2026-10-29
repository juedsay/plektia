import type { StatsEvent } from "@/domain/stats-event";

// Donde se suman las visitas y los clics (SPEC-click-analytics). Lo implementa
// el cliente de ingesta, con la clave de servicio, por `ingest_event`.

export interface StatsRecorder {
  /**
   * Suma el evento en los contadores del día. Lo que hace el dueño (`viewerId`)
   * o lo que no existe se ignora en la base, sin error.
   */
  record(event: StatsEvent, country: string, viewerId: string | null): Promise<void>;
}
