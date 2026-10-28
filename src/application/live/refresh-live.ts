import type {
  FeaturedContentProvider,
  ProviderError,
} from "@/application/ports/featured-content-provider";
import type { LiveStatusProvider } from "@/application/ports/live-status-provider";
import type { LiveProvider, LiveStore, LiveTarget } from "@/application/ports/live-store";
import type { PageCache } from "@/application/ports/page-cache";

// Refresco del estado en vivo (SPEC-live-status, historia 2): lo corre el cron
// cada 10 minutos. Solo los canales con "Transmito en este canal", en un lote
// por proveedor. Si un proveedor falla, no se guarda nada de él: sin revisión
// nueva, a los 25 minutos la página deja de mostrar "En vivo" (historia 5).

export const LIVE_JOB = "live";
/** Más que lo que tarda una corrida: si el Worker muere, el lock vence solo. */
const LOCK_SECONDS = 5 * 60;
/** Un canal de YouTube que no existe se reintenta al día siguiente. */
const CHANNEL_RETRY_MS = 24 * 60 * 60 * 1000;

export interface LiveRefreshSummary {
  readonly skipped: boolean;
  readonly checked: number;
  readonly purged: readonly string[];
  /** El error de cada proveedor que falló (sus canales quedan sin revisar). */
  readonly failed: Readonly<Partial<Record<LiveProvider, ProviderError>>>;
}

interface Deps {
  readonly store: LiveStore;
  /** Sin credenciales de un proveedor, sus canales no se revisan. */
  readonly providers: Readonly<Partial<Record<LiveProvider, LiveStatusProvider>>>;
  /** Para resolver `@handle` → `UC…` de YouTube (compartido con el destacado). */
  readonly youtubeChannels?: Pick<FeaturedContentProvider, "resolveChannel">;
  readonly cache: PageCache;
  readonly now?: () => Date;
}

export function refreshLive(deps: Deps) {
  const now = deps.now ?? (() => new Date());
  return async (): Promise<LiveRefreshSummary> => {
    if (!(await deps.store.tryLock(LIVE_JOB, LOCK_SECONDS))) {
      return { skipped: true, checked: 0, purged: [], failed: {} };
    }
    try {
      return await run(deps, now());
    } finally {
      await deps.store.releaseLock(LIVE_JOB);
    }
  };
}

async function run(deps: Deps, now: Date): Promise<LiveRefreshSummary> {
  const { store, providers, cache } = deps;
  const targets = await store.targets();
  const failed: Partial<Record<LiveProvider, ProviderError>> = {};
  const toPurge = new Set<string>();
  let checked = 0;

  // La clave con que se consulta a cada proveedor → el handle del link. Si
  // resolver un `@handle` nuevo falla, se dejan de resolver los demás en esta
  // corrida, pero los canales ya resueltos se revisan igual.
  const keys = new Map<LiveProvider, Map<string, string>>();
  const resolution: { error: ProviderError | null } = { error: null };
  for (const target of targets) {
    const key = await keyFor(target, deps, now, resolution);
    if (key === null) continue;
    const byKey = keys.get(target.provider) ?? new Map<string, string>();
    byKey.set(key, target.handle);
    keys.set(target.provider, byKey);
  }

  for (const [provider, byKey] of keys) {
    const adapter = providers[provider];
    if (!adapter || failed[provider]) continue;
    const result = await adapter.checkLive([...byKey.keys()]);
    if (!result.ok) {
      failed[provider] = result.error;
      continue;
    }
    for (const [key, handle] of byKey) {
      const state = result.value.get(key);
      if (!state) continue;
      checked++;
      for (const page of await store.saveLive(provider, handle, state)) toPurge.add(page);
    }
  }

  if (resolution.error && !failed.youtube) failed.youtube = resolution.error;
  for (const page of toPurge) await cache.purgeProfile(page);
  return { skipped: false, checked, purged: [...toPurge], failed };
}

/** Twitch se consulta por login; YouTube, por el ID `UC…` (que se resuelve una vez). */
async function keyFor(
  target: LiveTarget,
  deps: Deps,
  now: Date,
  resolution: { error: ProviderError | null },
): Promise<string | null> {
  if (target.provider === "twitch") return target.handle;
  if (target.channelId) return target.channelId;
  const due =
    target.channelCheckedAt === null ||
    now.getTime() - Date.parse(target.channelCheckedAt) >= CHANNEL_RETRY_MS;
  if (!due || !deps.youtubeChannels || resolution.error) return null;
  const resolved = await deps.youtubeChannels.resolveChannel(target.handle);
  if (!resolved.ok) {
    // Un error pasajero se reintenta en la próxima corrida (no se anota).
    resolution.error = resolved.error;
    return null;
  }
  await deps.store.saveChannel(
    target.handle,
    resolved.value,
    resolved.value ? null : "canal inexistente",
  );
  return resolved.value;
}
