import type { StatsRecorder } from "@/application/ports/stats-recorder";
import type { StatsEvent } from "@/domain/stats-event";
import type { Database } from "@/infrastructure/supabase/database.types";
import type { IngestClient } from "@/infrastructure/supabase/ingest-client";

// Visitas y clics por `ingest_event` (migración 20261106000000_stats.sql).

type Functions = Database["public"]["Functions"];

export class SupabaseStatsRecorder implements StatsRecorder {
  constructor(private readonly ingest: IngestClient) {}

  async record(event: StatsEvent, country: string, viewerId: string | null): Promise<void> {
    // La función acepta `null` en el handle, el link y quien mira; el
    // generador de tipos declara los parámetros de una función como no nulos.
    const args = {
      p_type: event.type,
      p_handle: event.type === "view" ? event.handle : null,
      p_link: event.type === "click" ? event.linkId : null,
      p_source: event.source,
      p_country: country,
      p_viewer: viewerId,
    } as unknown as Functions["ingest_event"]["Args"];
    const { error } = await this.ingest.call("ingest_event", args);
    if (error) throw new Error(`ingest_event: error de la base (${error.code}): ${error.message}`);
  }
}
