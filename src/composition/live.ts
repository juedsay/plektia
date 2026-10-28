import { refreshFeatured, type RefreshSummary } from "@/application/live/refresh-featured";
import type { PageCache } from "@/application/ports/page-cache";
import { createSafeFetch } from "@/infrastructure/http/safe-fetch";
import {
  YOUTUBE_API_HOST,
  YouTubeProvider,
} from "@/infrastructure/providers/youtube/youtube-provider";
import { createIngestClient } from "@/infrastructure/supabase/ingest-client";
import {
  IngestQuotaBudget,
  SupabaseFeaturedStore,
} from "@/infrastructure/supabase/supabase-featured-store";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- así se amplían los tipos de Workers.
  namespace Cloudflare {
    interface Env {
      /** Secreto del Worker (scripts/wizard-youtube.sh); en local, `.dev.vars`. */
      YOUTUBE_API_KEY?: string;
    }
  }
}

interface LiveConfig {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_SECRET_KEY?: string;
  readonly YOUTUBE_API_KEY?: string;
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
  const provider = new YouTubeProvider(
    config.YOUTUBE_API_KEY,
    createSafeFetch({ allowedHosts: [YOUTUBE_API_HOST] }),
    new IngestQuotaBudget(ingest),
  );
  return refreshFeatured({ store: new SupabaseFeaturedStore(ingest), provider, cache });
}
