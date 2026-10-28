import type { LiveState } from "@/application/ports/live-status-provider";
import type { LiveProvider, LiveStore, LiveTarget } from "@/application/ports/live-store";
import type { Database } from "@/infrastructure/supabase/database.types";
import type { IngestClient, IngestError } from "@/infrastructure/supabase/ingest-client";
import { SupabaseFeaturedStore } from "@/infrastructure/supabase/supabase-featured-store";

// Estado en vivo en la base, por las funciones `ingest_*` (migración
// 20261104000000_live_status.sql). El lock y los canales de YouTube son los
// mismos que usa el contenido destacado.

type Functions = Database["public"]["Functions"];
const PROVIDERS: ReadonlySet<string> = new Set<LiveProvider>(["youtube", "twitch"]);

export class SupabaseLiveStore implements LiveStore {
  private readonly shared: SupabaseFeaturedStore;

  constructor(private readonly ingest: IngestClient) {
    this.shared = new SupabaseFeaturedStore(ingest);
  }

  tryLock(job: string, seconds: number) {
    return this.shared.tryLock(job, seconds);
  }

  releaseLock(job: string) {
    return this.shared.releaseLock(job);
  }

  saveChannel(handle: string, channelId: string | null, error: string | null) {
    return this.shared.saveChannel(handle, channelId, error);
  }

  async targets(ownerId?: string): Promise<readonly LiveTarget[]> {
    const { data, error } = ownerId
      ? await this.ingest.call("ingest_live_targets_of", { p_owner: ownerId })
      : await this.ingest.call("ingest_live_targets", {});
    if (error) throw unexpected("ingest_live_targets", error);
    return (data ?? []).flatMap((row) =>
      PROVIDERS.has(row.provider)
        ? [
            {
              provider: row.provider as LiveProvider,
              handle: row.handle,
              channelId: row.channel_id,
              channelCheckedAt: row.channel_checked_at,
            },
          ]
        : [],
    );
  }

  async saveLive(
    provider: LiveProvider,
    handle: string,
    state: LiveState,
  ): Promise<readonly string[]> {
    // Offline va sin título, inicio ni URL; el generador de tipos declara los
    // parámetros de una función como no nulos.
    const args = {
      p_provider: provider,
      p_handle: handle,
      p_is_live: state.isLive,
      p_title: state.title,
      p_started_at: state.startedAt,
      p_url: state.url,
    } as unknown as Functions["ingest_live_status"]["Args"];
    const { data, error } = await this.ingest.call("ingest_live_status", args);
    if (error) throw unexpected("ingest_live_status", error);
    return data ?? [];
  }
}

function unexpected(fn: string, error: IngestError): Error {
  return new Error(`${fn}: error inesperado de la base (${error.code}): ${error.message}`);
}
