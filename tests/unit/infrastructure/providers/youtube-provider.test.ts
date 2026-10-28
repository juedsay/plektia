import { describe, expect, it } from "vitest";

import type { QuotaBudget } from "@/application/ports/featured-content-provider";
import { createSafeFetch } from "@/infrastructure/http/safe-fetch";
import {
  YOUTUBE_API_HOST,
  YouTubeProvider,
} from "@/infrastructure/providers/youtube/youtube-provider";
import { parseIsoDuration } from "@/infrastructure/providers/youtube/youtube-responses";

// Respuestas con el formato documentado de la YouTube Data API v3. La prueba
// contra la API real (que las playlists UULF/UUSH/UULV sigan existiendo) es
// `pnpm contract:youtube`, fuera del CI de PR.

const CHANNEL = "UCabcdefghijklmnopqrstuv";
const SUFFIX = CHANNEL.slice(2);

type Route = (params: URLSearchParams) => { status: number; body: unknown };

/** Un servidor falso de YouTube: responde por recurso y anota cada pedido. */
function fakeYouTube(routes: Readonly<Record<string, Route>>) {
  const calls: { resource: string; params: URLSearchParams; key: string | null }[] = [];
  const safeFetch = createSafeFetch({
    allowedHosts: [YOUTUBE_API_HOST],
    fetcher: (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const resource = url.pathname.replace("/youtube/v3/", "");
      const headers = new Headers(init?.headers);
      calls.push({ resource, params: url.searchParams, key: headers.get("X-Goog-Api-Key") });
      const route = routes[resource];
      const answer = route ? route(url.searchParams) : { status: 404, body: notFound("x") };
      return Promise.resolve(new Response(JSON.stringify(answer.body), { status: answer.status }));
    },
  });
  return { safeFetch, calls };
}

class CountingBudget implements QuotaBudget {
  spent = 0;
  constructor(private readonly limit = Number.POSITIVE_INFINITY) {}
  tryConsume(units: number) {
    if (this.spent + units > this.limit) return Promise.resolve(false);
    this.spent += units;
    return Promise.resolve(true);
  }
}

const notFound = (reason: string) => ({ error: { code: 404, errors: [{ reason }] } });

const playlistItem = (videoId: string, title: string, privacyStatus = "public") => ({
  snippet: { title, publishedAt: "2026-10-20T10:00:00Z" },
  contentDetails: { videoId, videoPublishedAt: "2026-10-19T10:00:00Z" },
  status: { privacyStatus },
});

const video = (id: string, duration: string, live?: { ended: boolean }) => ({
  id,
  snippet: { title: `Video ${id}`, publishedAt: "2026-10-18T10:00:00Z" },
  contentDetails: { duration },
  status: { privacyStatus: "public" },
  ...(live
    ? {
        liveStreamingDetails: {
          actualStartTime: "2026-10-18T10:00:00Z",
          ...(live.ended ? { actualEndTime: "2026-10-18T12:00:00Z" } : {}),
        },
      }
    : {}),
});

function provider(routes: Readonly<Record<string, Route>>, budget = new CountingBudget()) {
  const fake = fakeYouTube(routes);
  return {
    youtube: new YouTubeProvider("clave-de-prueba", fake.safeFetch, budget),
    ...fake,
    budget,
  };
}

describe("YouTubeProvider · canal", () => {
  it("resuelve un @handle con 1 unidad y la key en un header (no en la URL)", async () => {
    const { youtube, calls, budget } = provider({
      channels: (params) => ({
        status: 200,
        body: params.get("forHandle") === "@canal" ? { items: [{ id: CHANNEL }] } : {},
      }),
    });
    expect(await youtube.resolveChannel("@canal")).toEqual({ ok: true, value: CHANNEL });
    expect(await youtube.resolveChannel("@no-existe")).toEqual({ ok: true, value: null });
    expect(budget.spent).toBe(2);
    expect(calls[0]?.key).toBe("clave-de-prueba");
    expect(calls[0]?.params.has("key")).toBe(false);
  });

  it("un ID UC… no gasta cuota; un handle armado no llega a la API", async () => {
    const { youtube, calls } = provider({});
    expect(await youtube.resolveChannel(CHANNEL)).toEqual({ ok: true, value: CHANNEL });
    for (const handle of ["../../etc", "@a/../b", "https://evil.com", "@a", "canal&part=x"]) {
      expect(await youtube.resolveChannel(handle)).toEqual({ ok: true, value: null });
    }
    expect(calls).toEqual([]);
  });
});

describe("YouTubeProvider · lo último de cada tipo", () => {
  it("último video y último Short salen de UULF y UUSH (1 unidad), salteando privados", async () => {
    const { youtube, calls, budget } = provider({
      playlistItems: (params) => {
        const playlist = params.get("playlistId");
        if (playlist === `UULF${SUFFIX}`) {
          return {
            status: 200,
            body: {
              items: [
                playlistItem("privado0001", "Privado", "private"),
                playlistItem("largo000001", "Video largo"),
              ],
            },
          };
        }
        if (playlist === `UUSH${SUFFIX}`) {
          return { status: 200, body: { items: [playlistItem("short000001", "Un Short")] } };
        }
        return { status: 404, body: notFound("playlistNotFound") };
      },
    });

    expect(await youtube.latest(CHANNEL, "video")).toEqual({
      ok: true,
      value: {
        videoId: "largo000001",
        kind: "video",
        title: "Video largo",
        publishedAt: "2026-10-19T10:00:00Z",
        durationSeconds: null,
      },
    });
    expect(await youtube.latest(CHANNEL, "short")).toMatchObject({
      ok: true,
      value: { videoId: "short000001", kind: "short" },
    });
    expect(budget.spent).toBe(2);
    expect(calls.map((call) => call.resource)).toEqual(["playlistItems", "playlistItems"]);
  });

  it("último directo: el primero de UULV que ya terminó (2 unidades)", async () => {
    const { youtube, budget } = provider({
      playlistItems: () => ({
        status: 200,
        body: {
          items: [playlistItem("envivo00001", "En vivo"), playlistItem("termino0001", "Terminado")],
        },
      }),
      videos: () => ({
        status: 200,
        body: {
          items: [
            video("envivo00001", "P0D", { ended: false }),
            video("termino0001", "PT2H", { ended: true }),
          ],
        },
      }),
    });
    expect(await youtube.latest(CHANNEL, "stream")).toEqual({
      ok: true,
      value: {
        videoId: "termino0001",
        kind: "stream",
        title: "Video termino0001",
        publishedAt: "2026-10-18T10:00:00Z",
        durationSeconds: 7200,
      },
    });
    expect(budget.spent).toBe(2);
  });

  it("plan B: si la playlist derivada no existe, clasifica las subidas (UU…)", async () => {
    const { youtube, calls } = provider({
      playlistItems: (params) =>
        params.get("playlistId") === `UU${SUFFIX}`
          ? {
              status: 200,
              body: {
                items: [
                  playlistItem("directo0001", "Directo"),
                  playlistItem("short000002", "Short"),
                  playlistItem("largo000002", "Largo"),
                ],
              },
            }
          : { status: 404, body: notFound("playlistNotFound") },
      videos: () => ({
        status: 200,
        body: {
          items: [
            video("directo0001", "PT1H", { ended: true }),
            video("short000002", "PT59S"),
            video("largo000002", "PT12M3S"),
          ],
        },
      }),
    });

    expect(await youtube.latest(CHANNEL, "short")).toMatchObject({
      ok: true,
      value: { videoId: "short000002", kind: "short", durationSeconds: 59 },
    });
    expect(await youtube.latest(CHANNEL, "video")).toMatchObject({
      ok: true,
      value: { videoId: "largo000002", kind: "video", durationSeconds: 723 },
    });
    expect(calls.some((call) => call.resource === "search")).toBe(false);
  });

  it("plan B: sigue a la página siguiente hasta encontrar el tipo, con un tope", async () => {
    const pageOf = (token: string | null) => Number(token ?? "0");
    const { youtube, calls } = provider({
      playlistItems: (params) => {
        if (params.get("playlistId") !== `UU${SUFFIX}`) {
          return { status: 404, body: notFound("playlistNotFound") };
        }
        const page = pageOf(params.get("pageToken"));
        return {
          status: 200,
          body: {
            items: [
              playlistItem(`pagina${String(page).padStart(5, "0")}`, `Página ${String(page)}`),
            ],
            nextPageToken: String(page + 1),
          },
        };
      },
      videos: (params) => {
        const id = params.get("id") ?? "";
        // Solo la tercera página tiene un Short; el resto son videos largos.
        return {
          status: 200,
          body: { items: [video(id, id === "pagina00002" ? "PT30S" : "PT20M")] },
        };
      },
    });
    expect(await youtube.latest(CHANNEL, "short")).toMatchObject({
      ok: true,
      value: { videoId: "pagina00002", kind: "short" },
    });

    calls.length = 0;
    expect(await youtube.latest(CHANNEL, "stream")).toEqual({ ok: true, value: null });
    // 1 (UULV) + 4 páginas × (playlistItems + videos): nunca más que el tope.
    expect(calls).toHaveLength(9);
  });

  it("un canal sin nada de ese tipo es null; un ID que no es de canal no llama a la API", async () => {
    const { youtube, calls } = provider({
      playlistItems: () => ({ status: 200, body: { items: [] } }),
    });
    expect(await youtube.latest(CHANNEL, "video")).toEqual({ ok: true, value: null });
    expect(await youtube.latest("UC../../etc", "video")).toEqual({ ok: true, value: null });
    expect(calls).toHaveLength(1);
  });
});

describe("YouTubeProvider · video fijado", () => {
  it("un Short (≤ 3 min) se marca vertical; uno privado o inexistente es null", async () => {
    const { youtube } = provider({
      videos: (params) => {
        const id = params.get("id");
        if (id === "short000003") return { status: 200, body: { items: [video(id, "PT45S")] } };
        if (id === "privado0002") {
          return {
            status: 200,
            body: { items: [{ ...video(id, "PT5M"), status: { privacyStatus: "private" } }] },
          };
        }
        return { status: 200, body: { items: [] } };
      },
    });
    expect(await youtube.video("short000003")).toMatchObject({
      ok: true,
      value: { kind: "short", durationSeconds: 45 },
    });
    expect(await youtube.video("privado0002")).toEqual({ ok: true, value: null });
    expect(await youtube.video("no-existe01")).toEqual({ ok: true, value: null });
    expect(await youtube.video("x/../y")).toEqual({ ok: true, value: null });
  });
});

describe("YouTubeProvider · errores y cuota", () => {
  it.each([
    [403, { error: { code: 403, errors: [{ reason: "quotaExceeded" }] } }, "quota_exceeded"],
    [403, { error: { code: 403, errors: [{ reason: "rateLimitExceeded" }] } }, "rate_limited"],
    [429, {}, "rate_limited"],
    [500, { error: { code: 500 } }, "unavailable"],
    [400, { error: { code: 400, errors: [{ reason: "keyInvalid" }] } }, "unavailable"],
    [200, { items: "no es una lista" }, "invalid_response"],
  ] as const)("%i → %s", async (status, body, expected) => {
    const { youtube } = provider({ channels: () => ({ status, body }) });
    expect(await youtube.resolveChannel("@canal")).toEqual({ ok: false, error: expected });
  });

  it("sin presupuesto, no gasta cuota", async () => {
    const { youtube, calls } = provider({}, new CountingBudget(0));
    expect(await youtube.resolveChannel("@canal")).toEqual({
      ok: false,
      error: "budget_exhausted",
    });
    expect(calls).toEqual([]);
  });

  it("un cuerpo que no es JSON es invalid_response", async () => {
    const safeFetch = createSafeFetch({
      allowedHosts: [YOUTUBE_API_HOST],
      fetcher: () => Promise.resolve(new Response("<html>", { status: 200 })),
    });
    const youtube = new YouTubeProvider("k", safeFetch, new CountingBudget());
    expect(await youtube.resolveChannel("@canal")).toEqual({
      ok: false,
      error: "invalid_response",
    });
  });
});

describe("parseIsoDuration", () => {
  it.each([
    ["PT45S", 45],
    ["PT12M3S", 723],
    ["PT1H2M3S", 3723],
    ["P1DT1S", 86401],
    ["P0D", 0],
    ["1:23", null],
    [undefined, null],
  ] as const)("%s → %s", (value, seconds) => {
    expect(parseIsoDuration(value)).toBe(seconds);
  });
});
