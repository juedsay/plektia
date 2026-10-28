import type {
  FeaturedContentProvider,
  FeaturedKind,
  FeaturedVideo,
  ProviderError,
} from "@/application/ports/featured-content-provider";
import type { FeaturedStore, FeaturedTarget } from "@/application/ports/featured-store";
import type { PageCache } from "@/application/ports/page-cache";
import type { Result } from "@/domain/result";

// Refresco del contenido destacado (SPEC-live-status, historia 4): lo corre el
// cron cada hora. Solo consulta lo que cada link eligió, una vez por canal y
// tipo aunque varios links lo compartan, y guarda solo lo que cambió. Si algo
// falla, queda el último dato bueno.

export const FEATURED_JOB = "featured";
/** Más que lo que tarda una corrida: si el Worker muere, el lock vence solo. */
const LOCK_SECONDS = 10 * 60;
/** Un canal que no se pudo resolver se reintenta al día siguiente. */
const CHANNEL_RETRY_MS = 24 * 60 * 60 * 1000;
/** Un video fijado se vuelve a leer una vez por día (título, si se borró). */
const PINNED_REFRESH_MS = 24 * 60 * 60 * 1000;

const KIND_OF_MODE: Readonly<Record<string, FeaturedKind>> = {
  latest_video: "video",
  latest_short: "short",
  latest_stream: "stream",
};

/** Errores que piden frenar toda la corrida (esperar a la próxima). */
const STOPPING: ReadonlySet<ProviderError> = new Set([
  "quota_exceeded",
  "rate_limited",
  "budget_exhausted",
]);

export interface RefreshSummary {
  readonly skipped: boolean;
  readonly updated: number;
  readonly purged: readonly string[];
  /** Por qué se cortó antes de terminar, si se cortó. */
  readonly stoppedBy: ProviderError | null;
}

interface Deps {
  readonly store: FeaturedStore;
  readonly provider: FeaturedContentProvider;
  readonly cache: PageCache;
  readonly now?: () => Date;
}

export function refreshFeatured(deps: Deps) {
  const now = deps.now ?? (() => new Date());

  return async (): Promise<RefreshSummary> => {
    if (!(await deps.store.tryLock(FEATURED_JOB, LOCK_SECONDS))) {
      return { skipped: true, updated: 0, purged: [], stoppedBy: null };
    }
    try {
      return await run(deps, now());
    } finally {
      await deps.store.releaseLock(FEATURED_JOB);
    }
  };
}

async function run(deps: Deps, now: Date): Promise<RefreshSummary> {
  const { store, provider, cache } = deps;
  const targets = await store.targets();
  const toPurge = new Set<string>();
  let updated = 0;
  let stoppedBy: ProviderError | null = null;

  /** Llama al proveedor; un error que pide frenar corta todo lo que sigue. */
  const ask = async <T>(call: () => Promise<Result<T, ProviderError>>) => {
    if (stoppedBy) return null;
    const result = await call();
    if (result.ok) return result;
    if (STOPPING.has(result.error)) stoppedBy = result.error;
    return result;
  };

  // 1. Canales sin resolver (una vez por handle).
  const channels = new Map<string, string | null>();
  for (const target of targets) {
    if (channels.has(target.handle)) continue;
    channels.set(target.handle, target.channelId);
    const due =
      target.channelId === null &&
      (target.channelCheckedAt === null ||
        now.getTime() - Date.parse(target.channelCheckedAt) >= CHANNEL_RETRY_MS);
    if (!due) continue;
    const resolved = await ask(() => provider.resolveChannel(target.handle));
    if (!resolved) break;
    if (resolved.ok) {
      channels.set(target.handle, resolved.value);
      await store.saveChannel(
        target.handle,
        resolved.value,
        resolved.value ? null : "canal inexistente",
      );
    } else if (!STOPPING.has(resolved.error)) {
      await store.saveChannel(target.handle, null, resolved.error);
    }
  }

  // 2. Lo último de cada canal y tipo, una sola vez aunque lo pidan varios links.
  const latest = new Map<string, Result<FeaturedVideo | null, ProviderError> | null>();
  const pinned = new Map<string, Result<FeaturedVideo | null, ProviderError> | null>();
  const resultFor = async (target: FeaturedTarget) => {
    if (target.mode === "pinned") {
      const videoId = target.pinnedVideoId;
      if (!videoId) return null;
      const fresh =
        target.currentVideoId === videoId &&
        target.fetchedAt !== null &&
        now.getTime() - Date.parse(target.fetchedAt) < PINNED_REFRESH_MS;
      if (fresh) return null;
      if (!pinned.has(videoId)) pinned.set(videoId, await ask(() => provider.video(videoId)));
      return pinned.get(videoId) ?? null;
    }
    const channelId = channels.get(target.handle) ?? null;
    const kind = KIND_OF_MODE[target.mode];
    if (!channelId || !kind) return null;
    const key = `${channelId}:${kind}`;
    if (!latest.has(key)) latest.set(key, await ask(() => provider.latest(channelId, kind)));
    return latest.get(key) ?? null;
  };

  // 3. Se guarda lo que llegó; un error deja el último dato bueno.
  for (const target of targets) {
    const result = await resultFor(target);
    if (!result?.ok) continue;
    const handle = result.value
      ? await store.saveFeatured(target.linkId, result.value)
      : await store.clearFeatured(target.linkId);
    if (handle) {
      updated++;
      toPurge.add(handle);
    }
  }

  for (const handle of toPurge) await cache.purgeProfile(handle);
  return { skipped: false, updated, purged: [...toPurge], stoppedBy };
}
