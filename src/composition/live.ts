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
  type QuotaBucket,
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

/**
 * Cuota diaria de YouTube (SPEC-live-status, "Seguridad"): se corta al 80 % de
 * las 10.000 unidades gratis, y el total se reparte por trabajo para que
 * ninguno deje sin cuota a los otros. "Comprobar ahora" tiene además un tope
 * por cuenta: unas pocas cuentas (o un script) no gastan la de todos.
 */
export const YOUTUBE_QUOTA = {
  total: 8000,
  live: 5000,
  featured: 2000,
  checkNow: 1000,
  checkNowPerAccount: 50,
} as const;

/** Qué trabajo gasta la cuota (y, en "Comprobar ahora", de qué cuenta). */
export type QuotaScope =
  { readonly job: "live" | "featured" } | { readonly job: "check-now"; readonly ownerId: string };

/** Los fondos de los que descuenta cada llamada: el total primero. */
export function quotaBuckets(scope: QuotaScope): readonly [QuotaBucket, ...QuotaBucket[]] {
  const total: QuotaBucket = { name: "youtube", limit: YOUTUBE_QUOTA.total };
  if (scope.job !== "check-now") {
    return [total, { name: `youtube:${scope.job}`, limit: YOUTUBE_QUOTA[scope.job] }];
  }
  return [
    total,
    { name: "youtube:check-now", limit: YOUTUBE_QUOTA.checkNow },
    { name: `youtube:check-now:${scope.ownerId}`, limit: YOUTUBE_QUOTA.checkNowPerAccount },
  ];
}

/** Cada cuánto corre el cron del en vivo, en minutos (LIVE_CRON en src/worker.ts). */
export const LIVE_CRON_MINUTES = 10;

/**
 * Unidades por canal de YouTube en una revisión: la playlist de directos (1) y
 * su parte del lote de detalles (1 cada 50 videos, 3 por canal). Se redondea
 * para arriba: mejor revisar un canal menos que pasarse.
 */
export const YOUTUBE_UNITS_PER_CHANNEL = 1.1;

/** Cuántas corridas del cron faltan hoy, hasta la medianoche del Pacífico (cuando se renueva la cuota). */
export function liveRunsLeftToday(now: Date, everyMinutes = LIVE_CRON_MINUTES): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const minutesLeft = 24 * 60 - (hour * 60 + minute);
  return Math.max(1, Math.ceil(minutesLeft / everyMinutes));
}

/**
 * Cuántos canales de YouTube revisa esta corrida: lo que queda del fondo del en
 * vivo, repartido entre las corridas que faltan hoy. Con muchos canales, cada
 * uno se revisa menos seguido; nunca se gasta todo a la tarde.
 */
export function youtubeChannelsPerRun(remainingUnits: number, runsLeft: number): number {
  return Math.max(
    0,
    Math.floor(remainingUnits / Math.max(1, runsLeft) / YOUTUBE_UNITS_PER_CHANNEL),
  );
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
  const provider = youtubeProvider(
    config.YOUTUBE_API_KEY,
    new IngestQuotaBudget(ingest, quotaBuckets({ job: "featured" })),
  );
  return refreshFeatured({ store: new SupabaseFeaturedStore(ingest), provider, cache });
}

/**
 * El refresco del estado en vivo. Cada proveedor entra si están sus
 * credenciales; `null` si no hay ninguno: el cron no hace nada. La cuota de
 * YouTube sale del fondo del cron o, en "Comprobar ahora", del de la cuenta.
 */
export function createLiveRefresh(
  config: LiveConfig,
  cache: PageCache,
  scope: QuotaScope = { job: "live" },
): ((ownerId?: string) => Promise<LiveRefreshSummary>) | null {
  const { YOUTUBE_API_KEY, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = config;
  const hasTwitch = Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET);
  if (!YOUTUBE_API_KEY && !hasTwitch) return null;
  const ingest = createIngestClient(config);
  const budget = new IngestQuotaBudget(ingest, quotaBuckets(scope));
  const youtube = YOUTUBE_API_KEY ? youtubeProvider(YOUTUBE_API_KEY, budget) : undefined;
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
    // El cron reparte su fondo a lo largo del día; "Comprobar ahora" usa el suyo.
    ...(scope.job === "live"
      ? {
          youtubeChannelsPerRun: async () =>
            youtubeChannelsPerRun(await budget.remaining(), liveRunsLeftToday(new Date())),
        }
      : {}),
  });
}

/** YouTube, con el presupuesto diario de cuota del trabajo que lo usa. */
function youtubeProvider(apiKey: string, budget: IngestQuotaBudget) {
  return new YouTubeProvider(apiKey, createSafeFetch({ allowedHosts: [YOUTUBE_API_HOST] }), budget);
}
