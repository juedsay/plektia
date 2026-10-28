import { describe, expect, it } from "vitest";

import { refreshFeatured } from "@/application/live/refresh-featured";
import type {
  FeaturedContentProvider,
  FeaturedKind,
  FeaturedVideo,
  ProviderError,
} from "@/application/ports/featured-content-provider";
import type { FeaturedStore, FeaturedTarget } from "@/application/ports/featured-store";
import { err, ok, type Result } from "@/domain/result";

import { RecordingPageCache } from "./fakes/recording-page-cache";

const NOW = new Date("2026-10-28T12:00:00Z");
const CHANNEL = "UCabcdefghijklmnopqrstuv";

const video = (videoId: string, kind: FeaturedKind = "video"): FeaturedVideo => ({
  videoId,
  kind,
  title: `Video ${videoId}`,
  publishedAt: "2026-10-27T10:00:00Z",
  durationSeconds: 600,
});

function target(linkId: string, extra: Partial<FeaturedTarget> = {}): FeaturedTarget {
  return {
    linkId,
    handle: "@canal",
    mode: "latest_video",
    pinnedVideoId: null,
    channelId: CHANNEL,
    channelCheckedAt: "2026-10-01T00:00:00Z",
    currentVideoId: null,
    fetchedAt: null,
    ...extra,
  };
}

/** Base falsa: guarda lo destacado por link y devuelve la página si cambió. */
class FakeStore implements FeaturedStore {
  locked = false;
  released = 0;
  featured = new Map<string, string>();
  channels: { handle: string; channelId: string | null; error: string | null }[] = [];
  constructor(public list: FeaturedTarget[]) {}

  tryLock() {
    if (this.locked) return Promise.resolve(false);
    this.locked = true;
    return Promise.resolve(true);
  }
  releaseLock() {
    this.locked = false;
    this.released++;
    return Promise.resolve();
  }
  targets() {
    return Promise.resolve(this.list);
  }
  saveChannel(handle: string, channelId: string | null, error: string | null) {
    this.channels.push({ handle, channelId, error });
    return Promise.resolve();
  }
  saveFeatured(linkId: string, saved: FeaturedVideo) {
    const changed = this.featured.get(linkId) !== saved.videoId;
    this.featured.set(linkId, saved.videoId);
    return Promise.resolve(changed ? `pagina-de-${linkId}` : null);
  }
  clearFeatured(linkId: string) {
    const had = this.featured.delete(linkId);
    return Promise.resolve(had ? `pagina-de-${linkId}` : null);
  }
}

/** Proveedor falso: responde lo configurado y anota cada llamada. */
class FakeProvider implements FeaturedContentProvider {
  calls: string[] = [];
  channelAnswer: Result<string | null, ProviderError> = ok(CHANNEL);
  latestAnswers = new Map<string, Result<FeaturedVideo | null, ProviderError>>();
  videoAnswer: Result<FeaturedVideo | null, ProviderError> = ok(video("fijado00001"));

  resolveChannel(handle: string) {
    this.calls.push(`channel:${handle}`);
    return Promise.resolve(this.channelAnswer);
  }
  latest(channelId: string, kind: FeaturedKind) {
    this.calls.push(`latest:${channelId}:${kind}`);
    return Promise.resolve(
      this.latestAnswers.get(kind) ?? ok(video(`ultimo-${kind}`.slice(0, 11), kind)),
    );
  }
  video(videoId: string) {
    this.calls.push(`video:${videoId}`);
    return Promise.resolve(this.videoAnswer);
  }
}

function setup(targets: FeaturedTarget[]) {
  const store = new FakeStore(targets);
  const provider = new FakeProvider();
  const cache = new RecordingPageCache();
  const refresh = refreshFeatured({ store, provider, cache, now: () => NOW });
  return { store, provider, cache, refresh };
}

describe("refreshFeatured", () => {
  it("consulta una vez por canal y tipo aunque varios links lo compartan, y purga lo que cambió", async () => {
    const { provider, cache, refresh } = setup([
      target("a"),
      target("b"),
      target("c", { mode: "latest_short" }),
    ]);
    const summary = await refresh();

    expect(provider.calls).toEqual([`latest:${CHANNEL}:video`, `latest:${CHANNEL}:short`]);
    expect(summary).toEqual({
      skipped: false,
      updated: 3,
      purged: ["pagina-de-a", "pagina-de-b", "pagina-de-c"],
      stoppedBy: null,
    });
    expect(cache.purged).toEqual([
      "profile:pagina-de-a",
      "profile:pagina-de-b",
      "profile:pagina-de-c",
    ]);
  });

  it("lo mismo otra vez no purga nada", async () => {
    const { cache, refresh } = setup([target("a")]);
    await refresh();
    cache.purged.length = 0;
    expect((await refresh()).updated).toBe(0);
    expect(cache.purged).toEqual([]);
  });

  it("con otra corrida en curso, no hace nada; al terminar, siempre libera el lock", async () => {
    const { store, provider, refresh } = setup([target("a")]);
    store.locked = true;
    expect(await refresh()).toEqual({ skipped: true, updated: 0, purged: [], stoppedBy: null });
    expect(provider.calls).toEqual([]);

    store.locked = false;
    store.targets = () => Promise.reject(new Error("se cayó la base"));
    await expect(refresh()).rejects.toThrow("se cayó la base");
    expect(store.locked).toBe(false);
  });

  it("resuelve una vez cada canal pendiente; uno inexistente se anota y se reintenta al día", async () => {
    const { store, provider, refresh } = setup([
      target("a", { handle: "@nuevo", channelId: null, channelCheckedAt: null }),
      target("b", { handle: "@nuevo", channelId: null, channelCheckedAt: null }),
      target("c", {
        handle: "@reciente",
        channelId: null,
        channelCheckedAt: "2026-10-28T06:00:00Z",
      }),
    ]);
    provider.channelAnswer = ok(null);
    await refresh();
    expect(provider.calls).toEqual(["channel:@nuevo"]);
    expect(store.channels).toEqual([
      { handle: "@nuevo", channelId: null, error: "canal inexistente" },
    ]);
  });

  it("un error pasajero al resolver el canal no se anota: se reintenta en la próxima corrida", async () => {
    const { store, provider, refresh } = setup([
      target("a", { handle: "@nuevo", channelId: null, channelCheckedAt: null }),
    ]);
    provider.channelAnswer = err("unavailable");
    await refresh();
    expect(store.channels).toEqual([]);
    expect(store.featured.size).toBe(0);
  });

  it("el canal recién resuelto se usa en la misma corrida", async () => {
    const { store, provider, refresh } = setup([
      target("a", { handle: "@nuevo", channelId: null, channelCheckedAt: null }),
    ]);
    await refresh();
    expect(provider.calls).toEqual(["channel:@nuevo", `latest:${CHANNEL}:video`]);
    expect(store.channels[0]?.channelId).toBe(CHANNEL);
    expect(store.featured.get("a")).toBe("ultimo-vide");
  });

  it("un video fijado se lee al fijarlo y después una vez por día", async () => {
    const pinned = (extra: Partial<FeaturedTarget>) =>
      target("a", { mode: "pinned", pinnedVideoId: "fijado00001", ...extra });

    const nuevo = setup([pinned({})]);
    await nuevo.refresh();
    expect(nuevo.provider.calls).toEqual(["video:fijado00001"]);

    const fresco = setup([
      pinned({ currentVideoId: "fijado00001", fetchedAt: "2026-10-28T02:00:00Z" }),
    ]);
    await fresco.refresh();
    expect(fresco.provider.calls).toEqual([]);

    const viejo = setup([
      pinned({ currentVideoId: "fijado00001", fetchedAt: "2026-10-27T02:00:00Z" }),
    ]);
    await viejo.refresh();
    expect(viejo.provider.calls).toEqual(["video:fijado00001"]);
  });

  it("si el canal ya no tiene nada de ese tipo, saca lo destacado", async () => {
    const { store, provider, cache, refresh } = setup([target("a")]);
    store.featured.set("a", "viejo000001");
    provider.latestAnswers.set("video", ok(null));
    await refresh();
    expect(store.featured.has("a")).toBe(false);
    expect(cache.purged).toEqual(["profile:pagina-de-a"]);
  });

  it("un error deja el último dato bueno; sin cuota se corta la corrida", async () => {
    const { store, provider, refresh } = setup([
      target("a"),
      target("b", { mode: "latest_short" }),
      target("c", { mode: "latest_stream" }),
    ]);
    store.featured.set("a", "bueno000001");
    provider.latestAnswers.set("video", err("unavailable"));
    provider.latestAnswers.set("short", err("quota_exceeded"));

    const summary = await refresh();
    expect(store.featured.get("a")).toBe("bueno000001");
    expect(summary.stoppedBy).toBe("quota_exceeded");
    // Después del corte no se pide nada más (el directo de "c" queda para la próxima).
    expect(provider.calls).toEqual([`latest:${CHANNEL}:video`, `latest:${CHANNEL}:short`]);
  });
});
