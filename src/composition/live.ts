import { refreshFeatured, type RefreshSummary } from "@/application/live/refresh-featured";
import { type LiveRefreshSummary, refreshLive } from "@/application/live/refresh-live";
import type { PageCache } from "@/application/ports/page-cache";
import { createSafeFetch } from "@/infrastructure/http/safe-fetch";
import { TWITCH_HOSTS, TwitchProvider } from "@/infrastructure/providers/twitch/twitch-provider";
import {
  YOUTUBE_API_HOST,
  YouTubeProvider,
} from "@/infrastructure/providers/youtube/youtube-provider";
import { createIngestClient, type IngestConfig } from "@/infrastructure/supabase/ingest-client";
import {
  IngestQuotaBudget,
  SupabaseFeaturedStore,
} from "@/infrastructure/supabase/supabase-featured-store";
import { SupabaseLiveStore } from "@/infrastructure/supabase/supabase-live-store";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- así se amplían los tipos de Workers.
  namespace Cloudflare {
    interface Env {
      /** Secreto del Worker (scripts/wizard-youtube.sh); en local, `.dev.vars`. */
      YOUTUBE_API_KEY?: string;
      /** Secretos del Worker (scripts/wizard-twitch.sh); en local, `.dev.vars`. */
      TWITCH_CLIENT_ID?: string;
      TWITCH_CLIENT_SECRET?: string;
    }
  }
}

interface LiveConfig extends IngestConfig {
  readonly YOUTUBE_API_KEY?: string;
  readonly TWITCH_CLIENT_ID?: string;
  readonly TWITCH_CLIENT_SECRET?: string;
}

/**
 * El refresco del contenido destacado, armado con sus adaptadores. `null` si
 * falta la API key de YouTube (todavía no se corrió el wizard): el cron no hace nada.
 */
export function createFeaturedRefresh(
  config: LiveConfig,
  cache: PageCache,
): (() => Promise<RefreshSummary>) | null {
  if (!config.YOUTUBE_API_KEY) return null;
  const ingest = createIngestClient(config);
  const provider = youtubeProvider(config.YOUTUBE_API_KEY, ingest);
  return refreshFeatured({ store: new SupabaseFeaturedStore(ingest), provider, cache });
}

/**
 * El refresco del estado en vivo. Cada proveedor entra si están sus
 * credenciales; `null` si no hay ninguno: el cron no hace nada.
 */
export function createLiveRefresh(
  config: LiveConfig,
  cache: PageCache,
): (() => Promise<LiveRefreshSummary>) | null {
  const { YOUTUBE_API_KEY, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = config;
  const hasTwitch = Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET);
  if (!YOUTUBE_API_KEY && !hasTwitch) return null;
  const ingest = createIngestClient(config);
  const youtube = YOUTUBE_API_KEY ? youtubeProvider(YOUTUBE_API_KEY, ingest) : undefined;
  const twitch =
    TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET
      ? new TwitchProvider(
          TWITCH_CLIENT_ID,
          TWITCH_CLIENT_SECRET,
          createSafeFetch({ allowedHosts: [...TWITCH_HOSTS] }),
        )
      : undefined;
  return refreshLive({
    store: new SupabaseLiveStore(ingest),
    providers: { ...(youtube ? { youtube } : {}), ...(twitch ? { twitch } : {}) },
    ...(youtube ? { youtubeChannels: youtube } : {}),
    cache,
  });
}

/** YouTube, con su presupuesto diario de cuota compartido entre trabajos. */
function youtubeProvider(apiKey: string, ingest: ReturnType<typeof createIngestClient>) {
  return new YouTubeProvider(
    apiKey,
    createSafeFetch({ allowedHosts: [YOUTUBE_API_HOST] }),
    new IngestQuotaBudget(ingest),
  );
}
