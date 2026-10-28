import type { FeaturedVideo, QuotaBudget } from "@/application/ports/featured-content-provider";
import type { FeaturedStore, FeaturedTarget } from "@/application/ports/featured-store";
import type { Database } from "@/infrastructure/supabase/database.types";
import type { IngestClient, IngestError } from "@/infrastructure/supabase/ingest-client";

// Contenido destacado en la base, por las funciones `ingest_*` (migración
// 20261102000000_featured_content.sql). Un error de la base es inesperado: se
// lanza y la corrida del cron termina (el lock vence solo).

type Functions = Database["public"]["Functions"];

const MODES = new Set(["latest_video", "latest_short", "latest_stream", "pinned"]);

export class SupabaseFeaturedStore implements FeaturedStore {
  constructor(private readonly ingest: IngestClient) {}

  async tryLock(job: string, seconds: number): Promise<boolean> {
    const { data, error } = await this.ingest.call("ingest_try_lock", {
      p_job: job,
      p_seconds: seconds,
    });
    if (error) throw unexpected("ingest_try_lock", error);
    return data === true;
  }

  async releaseLock(job: string): Promise<void> {
    const { error } = await this.ingest.call("ingest_release_lock", { p_job: job });
    if (error) throw unexpected("ingest_release_lock", error);
  }

  async targets(): Promise<readonly FeaturedTarget[]> {
    const { data, error } = await this.ingest.call("ingest_featured_targets", {});
    if (error) throw unexpected("ingest_featured_targets", error);
    return (data ?? []).flatMap((row) =>
      MODES.has(row.featured_mode)
        ? [
            {
              linkId: row.link_id,
              handle: row.handle,
              mode: row.featured_mode as FeaturedTarget["mode"],
              pinnedVideoId: row.pinned_video_id,
              channelId: row.channel_id,
              channelCheckedAt: row.channel_checked_at,
              currentVideoId: row.current_video_id,
              fetchedAt: row.fetched_at,
            },
          ]
        : [],
    );
  }

  async saveChannel(handle: string, channelId: string | null, error: string | null) {
    // La función acepta `null` (canal inexistente, sin error); el generador de
    // tipos declara los parámetros de una función como no nulos.
    const args = {
      p_provider: "youtube",
      p_handle: handle,
      p_external_id: channelId,
      p_error: error,
    } as unknown as Functions["ingest_channel"]["Args"];
    const result = await this.ingest.call("ingest_channel", args);
    if (result.error) throw unexpected("ingest_channel", result.error);
  }

  async saveFeatured(linkId: string, video: FeaturedVideo): Promise<string | null> {
    const args = {
      p_link_id: linkId,
      p_video_id: video.videoId,
      p_kind: video.kind,
      p_title: video.title,
      p_published_at: video.publishedAt,
      p_duration_s: video.durationSeconds,
    } as unknown as Functions["ingest_featured"]["Args"];
    const { data, error } = await this.ingest.call("ingest_featured", args);
    if (error) throw unexpected("ingest_featured", error);
    return data ?? null;
  }

  async clearFeatured(linkId: string): Promise<string | null> {
    const { data, error } = await this.ingest.call("ingest_featured_clear", { p_link_id: linkId });
    if (error) throw unexpected("ingest_featured_clear", error);
    return data ?? null;
  }
}

/**
 * Presupuesto diario de la cuota de YouTube, compartido entre corridas: se
 * corta al 80 % de las 10.000 unidades gratis (SPEC-live-status, "Seguridad").
 */
export class IngestQuotaBudget implements QuotaBudget {
  constructor(
    private readonly ingest: IngestClient,
    private readonly provider = "youtube",
    private readonly dailyLimit = 8000,
  ) {}

  async tryConsume(units: number): Promise<boolean> {
    const { data, error } = await this.ingest.call("ingest_consume_quota", {
      p_provider: this.provider,
      p_units: units,
      p_daily_limit: this.dailyLimit,
    });
    if (error) throw unexpected("ingest_consume_quota", error);
    return data === true;
  }
}

function unexpected(fn: string, error: IngestError): Error {
  return new Error(`${fn}: error inesperado de la base (${error.code}): ${error.message}`);
}
