import { describe, expect, it } from "vitest";

import type { QuotaBudget } from "@/application/ports/featured-content-provider";
import type { LiveStatusProvider } from "@/application/ports/live-status-provider";
import { createSafeFetch } from "@/infrastructure/http/safe-fetch";
import { TWITCH_HOSTS, TwitchProvider } from "@/infrastructure/providers/twitch/twitch-provider";
import {
  YOUTUBE_API_HOST,
  YouTubeProvider,
} from "@/infrastructure/providers/youtube/youtube-provider";

// La misma suite de contrato para cada `LiveStatusProvider` (SPEC-live-status,
// "Testing"): en vivo, offline, canal inexistente y error del proveedor, con
// respuestas en el formato de cada API. Sumar un proveedor es sumar su `World`.

/** Lo que el servidor falso de un proveedor sabe responder. */
interface World {
  readonly name: string;
  /** Un canal en vivo, uno offline y uno que no existe (claves del proveedor). */
  readonly live: string;
  readonly offline: string;
  readonly missing: string;
  /** El proveedor, contra un servidor que responde `failing ? 500 : normal`. */
  make(failing: boolean): { provider: LiveStatusProvider; requests: () => number };
}

const unlimited: QuotaBudget = { tryConsume: () => Promise.resolve(true) };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

const twitch: World = {
  name: "Twitch",
  live: "streamer_en_vivo",
  offline: "streamer_offline",
  missing: "no_existe_este",
  make(failing) {
    let requests = 0;
    const safeFetch = createSafeFetch({
      allowedHosts: [...TWITCH_HOSTS],
      fetcher: (input) => {
        requests++;
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (url.hostname === "id.twitch.tv") {
          return Promise.resolve(json(200, { access_token: "token", expires_in: 3600 }));
        }
        if (failing) return Promise.resolve(json(500, { error: "Internal Server Error" }));
        const logins = url.searchParams.getAll("user_login");
        const data = logins.includes("streamer_en_vivo")
          ? [
              {
                user_login: "streamer_en_vivo",
                type: "live",
                title: "Programando en vivo",
                started_at: "2026-10-28T11:00:00Z",
              },
            ]
          : [];
        return Promise.resolve(json(200, { data }));
      },
    });
    return {
      provider: new TwitchProvider("cliente", "secreto", safeFetch),
      requests: () => requests,
    };
  },
};

const LIVE_CHANNEL = "UCenvivoenvivoenvivo0001";
const OFFLINE_CHANNEL = "UCofflineofflineoffline1";
const MISSING_CHANNEL = "UCnoexistenoexistenoexi1";

const youtube: World = {
  name: "YouTube",
  live: LIVE_CHANNEL,
  offline: OFFLINE_CHANNEL,
  missing: MISSING_CHANNEL,
  make(failing) {
    let requests = 0;
    const safeFetch = createSafeFetch({
      allowedHosts: [YOUTUBE_API_HOST],
      fetcher: (input) => {
        requests++;
        if (failing) return Promise.resolve(json(500, { error: { code: 500 } }));
        const url = new URL(input instanceof Request ? input.url : String(input));
        const item = (videoId: string) => ({
          snippet: { title: videoId },
          contentDetails: { videoId },
          status: { privacyStatus: "public" },
        });
        if (url.pathname.endsWith("/playlistItems")) {
          const playlist = url.searchParams.get("playlistId");
          if (playlist === `UULV${LIVE_CHANNEL.slice(2)}`) {
            return Promise.resolve(json(200, { items: [item("envivo00001")] }));
          }
          if (playlist === `UULV${OFFLINE_CHANNEL.slice(2)}`) {
            return Promise.resolve(json(200, { items: [item("termino0001")] }));
          }
          return Promise.resolve(
            json(404, { error: { code: 404, errors: [{ reason: "playlistNotFound" }] } }),
          );
        }
        const video = (id: string, ended: boolean) => ({
          id,
          snippet: {
            title: "Programando en vivo",
            publishedAt: "2026-10-28T11:00:00Z",
            liveBroadcastContent: ended ? "none" : "live",
          },
          liveStreamingDetails: {
            actualStartTime: "2026-10-28T11:00:00Z",
            ...(ended ? { actualEndTime: "2026-10-28T12:00:00Z" } : {}),
          },
        });
        const ids = (url.searchParams.get("id") ?? "").split(",");
        return Promise.resolve(
          json(200, {
            items: ids
              .filter((id) => id === "envivo00001" || id === "termino0001")
              .map((id) => video(id, id === "termino0001")),
          }),
        );
      },
    });
    return {
      provider: new YouTubeProvider("clave", safeFetch, unlimited),
      requests: () => requests,
    };
  },
};

for (const world of [twitch, youtube]) {
  describe(`LiveStatusProvider · contrato · ${world.name}`, () => {
    it("un canal en vivo vuelve con título, inicio y adónde llevar", async () => {
      const { provider } = world.make(false);
      const result = await provider.checkLive([world.live]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.get(world.live)).toMatchObject({
        isLive: true,
        title: "Programando en vivo",
        startedAt: "2026-10-28T11:00:00Z",
      });
      expect(result.value.get(world.live)?.url).toMatch(
        /^https:\/\/www\.(twitch\.tv|youtube\.com)\//,
      );
    });

    it("uno offline y uno inexistente vuelven offline, con la misma clave", async () => {
      const { provider } = world.make(false);
      const result = await provider.checkLive([world.offline, world.missing]);
      expect(result).toEqual({
        ok: true,
        value: new Map([
          [world.offline, { isLive: false, title: null, startedAt: null, url: null }],
          [world.missing, { isLive: false, title: null, startedAt: null, url: null }],
        ]),
      });
    });

    it("un lote mixto separa cada canal", async () => {
      const { provider } = world.make(false);
      const result = await provider.checkLive([world.live, world.offline, world.missing]);
      if (!result.ok) throw new Error("debía responder");
      expect([...result.value].map(([channel, state]) => [channel, state.isLive])).toEqual([
        [world.live, true],
        [world.offline, false],
        [world.missing, false],
      ]);
    });

    it("un error del proveedor es un error de todo el lote (no se inventa un offline)", async () => {
      const { provider } = world.make(true);
      expect(await provider.checkLive([world.live, world.offline])).toEqual({
        ok: false,
        error: "unavailable",
      });
    });

    it("sin canales no hace ningún pedido", async () => {
      const { provider, requests } = world.make(false);
      expect(await provider.checkLive([])).toEqual({ ok: true, value: new Map() });
      expect(requests()).toBe(0);
    });
  });
}
