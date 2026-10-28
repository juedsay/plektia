import { describe, expect, it } from "vitest";

import { refreshLive } from "@/application/live/refresh-live";
import type { ProviderError } from "@/application/ports/featured-content-provider";
import {
  type LiveState,
  type LiveStatusProvider,
  OFFLINE,
} from "@/application/ports/live-status-provider";
import type { LiveProvider, LiveStore, LiveTarget } from "@/application/ports/live-store";
import { err, ok, type Result } from "@/domain/result";

import { RecordingPageCache } from "./fakes/recording-page-cache";

const NOW = new Date("2026-10-28T12:00:00Z");
const CHANNEL = "UCabcdefghijklmnopqrstuv";

const live = (title: string): LiveState => ({
  isLive: true,
  title,
  startedAt: "2026-10-28T11:00:00Z",
  url: "https://www.twitch.tv/canal",
});

function target(provider: LiveProvider, handle: string, extra: Partial<LiveTarget> = {}) {
  return { provider, handle, channelId: null, channelCheckedAt: null, ...extra };
}

/** Base falsa: guarda el último estado por canal y purga solo si cambió. */
class FakeStore implements LiveStore {
  locked = false;
  lockedJobs: string[] = [];
  askedFor: (string | undefined)[] = [];
  saved = new Map<string, LiveState>();
  channels: { handle: string; channelId: string | null }[] = [];
  constructor(public list: LiveTarget[]) {}

  tryLock(job: string) {
    if (this.locked) return Promise.resolve(false);
    this.locked = true;
    this.lockedJobs.push(job);
    return Promise.resolve(true);
  }
  releaseLock() {
    this.locked = false;
    return Promise.resolve();
  }
  targets(ownerId?: string) {
    this.askedFor.push(ownerId);
    return Promise.resolve(this.list);
  }
  saveChannel(handle: string, channelId: string | null) {
    this.channels.push({ handle, channelId });
    return Promise.resolve();
  }
  saveLive(provider: LiveProvider, handle: string, state: LiveState) {
    const key = `${provider}:${handle}`;
    const changed = this.saved.get(key)?.isLive !== state.isLive;
    this.saved.set(key, state);
    return Promise.resolve(changed ? [`pagina-${handle.replace("@", "")}`] : []);
  }
}

/** Proveedor falso: responde un estado por clave y anota cada lote pedido. */
class FakeProvider implements LiveStatusProvider {
  batches: string[][] = [];
  answer: Result<ReadonlyMap<string, LiveState>, ProviderError> | null = null;
  constructor(private readonly liveKeys: ReadonlySet<string> = new Set()) {}

  checkLive(channels: readonly string[]) {
    this.batches.push([...channels]);
    if (this.answer) return Promise.resolve(this.answer);
    return Promise.resolve(
      ok(
        new Map(
          channels.map((channel) => [
            channel,
            this.liveKeys.has(channel) ? live(`Directo de ${channel}`) : OFFLINE,
          ]),
        ),
      ),
    );
  }
}

function setup(
  targets: LiveTarget[],
  providers: { twitch?: FakeProvider; youtube?: FakeProvider },
  resolve: Result<string | null, ProviderError> = ok(CHANNEL),
) {
  const store = new FakeStore(targets);
  const cache = new RecordingPageCache();
  const resolved: string[] = [];
  const refresh = refreshLive({
    store,
    providers,
    youtubeChannels: {
      resolveChannel: (handle) => {
        resolved.push(handle);
        return Promise.resolve(resolve);
      },
    },
    cache,
    now: () => NOW,
  });
  return { store, cache, refresh, resolved };
}

describe("refreshLive", () => {
  it("revisa cada proveedor en un solo lote y purga las páginas que cambiaron", async () => {
    const twitch = new FakeProvider(new Set(["canal"]));
    const youtube = new FakeProvider();
    const { cache, refresh } = setup(
      [
        target("twitch", "canal"),
        target("twitch", "otro"),
        target("youtube", "@tubo", { channelId: CHANNEL }),
      ],
      { twitch, youtube },
    );
    const summary = await refresh();
    expect(twitch.batches).toEqual([["canal", "otro"]]);
    expect(youtube.batches).toEqual([[CHANNEL]]);
    expect(summary).toMatchObject({ skipped: false, checked: 3, failed: {} });
    expect(cache.purged).toEqual([
      "profile:pagina-canal",
      "profile:pagina-otro",
      "profile:pagina-tubo",
    ]);
  });

  it("sin cambios no purga nada", async () => {
    const { cache, refresh } = setup([target("twitch", "canal")], {
      twitch: new FakeProvider(),
    });
    await refresh();
    cache.purged.length = 0;
    await refresh();
    expect(cache.purged).toEqual([]);
  });

  it("si un proveedor falla, no guarda nada de él (la regla de 25 minutos apaga el aviso) y sigue con el otro", async () => {
    const twitch = new FakeProvider();
    twitch.answer = err("unavailable");
    const youtube = new FakeProvider(new Set([CHANNEL]));
    const { store, refresh } = setup(
      [target("twitch", "canal"), target("youtube", "@tubo", { channelId: CHANNEL })],
      { twitch, youtube },
    );
    const summary = await refresh();
    expect(summary.failed).toEqual({ twitch: "unavailable" });
    expect(store.saved.has("twitch:canal")).toBe(false);
    expect(store.saved.get("youtube:@tubo")?.isLive).toBe(true);
  });

  it("un canal de YouTube se resuelve una vez y se revisa en la misma corrida", async () => {
    const youtube = new FakeProvider(new Set([CHANNEL]));
    const { store, refresh, resolved } = setup([target("youtube", "@nuevo")], { youtube });
    await refresh();
    expect(resolved).toEqual(["@nuevo"]);
    expect(store.channels).toEqual([{ handle: "@nuevo", channelId: CHANNEL }]);
    expect(youtube.batches).toEqual([[CHANNEL]]);
  });

  it("un error al resolver no frena los canales de YouTube ya resueltos", async () => {
    const youtube = new FakeProvider(new Set([CHANNEL]));
    const { store, refresh } = setup(
      [target("youtube", "@nuevo"), target("youtube", "@viejo", { channelId: CHANNEL })],
      { youtube },
      err("unavailable"),
    );
    const summary = await refresh();
    expect(store.channels).toEqual([]);
    expect(youtube.batches).toEqual([[CHANNEL]]);
    expect(summary.failed).toEqual({ youtube: "unavailable" });
  });

  it("un canal inexistente se anota y se reintenta al día siguiente", async () => {
    const youtube = new FakeProvider();
    const pending = setup([target("youtube", "@nadie")], { youtube }, ok(null));
    await pending.refresh();
    expect(pending.store.channels).toEqual([{ handle: "@nadie", channelId: null }]);
    expect(youtube.batches).toEqual([]);

    const recent = setup(
      [target("youtube", "@nadie", { channelCheckedAt: "2026-10-28T06:00:00Z" })],
      { youtube },
    );
    await recent.refresh();
    expect(recent.resolved).toEqual([]);
  });

  it("sin credenciales de un proveedor, sus canales no se revisan", async () => {
    const { store, refresh } = setup([target("twitch", "canal")], {});
    expect((await refresh()).checked).toBe(0);
    expect(store.saved.size).toBe(0);
  });

  it("con otra corrida en curso no hace nada; al terminar libera el lock aunque falle", async () => {
    const twitch = new FakeProvider();
    const { store, refresh } = setup([target("twitch", "canal")], { twitch });
    store.locked = true;
    expect(await refresh()).toEqual({ skipped: true, checked: 0, purged: [], failed: {} });
    expect(twitch.batches).toEqual([]);

    store.locked = false;
    store.targets = () => Promise.reject(new Error("se cayó la base"));
    await expect(refresh()).rejects.toThrow("se cayó la base");
    expect(store.locked).toBe(false);
  });

  it("con una cuenta, revisa solo sus canales y con un lock propio", async () => {
    const twitch = new FakeProvider();
    const { store, refresh } = setup([target("twitch", "canal")], { twitch });
    await refresh("cuenta-1");
    await refresh();
    expect(store.askedFor).toEqual(["cuenta-1", undefined]);
    expect(store.lockedJobs).toEqual(["live:cuenta-1", "live"]);
  });
});
