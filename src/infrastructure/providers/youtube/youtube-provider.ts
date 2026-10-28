import type { z } from "zod";

import type {
  FeaturedContentProvider,
  FeaturedKind,
  FeaturedVideo,
  ProviderError,
  QuotaBudget,
} from "@/application/ports/featured-content-provider";
import {
  type LiveState,
  type LiveStatusProvider,
  OFFLINE,
} from "@/application/ports/live-status-provider";
import { err, ok, type Result } from "@/domain/result";
import type { SafeFetch } from "@/infrastructure/http/safe-fetch";
import {
  ChannelsResponse,
  ErrorResponse,
  parseIsoDuration,
  type PlaylistItem,
  PlaylistItemsResponse,
  type VideoItem,
  VideosResponse,
} from "@/infrastructure/providers/youtube/youtube-responses";

// Adaptador de la YouTube Data API v3 (SPEC-live-status, "Cómo se obtiene cada
// dato"). Lo último de cada tipo sale de las playlists derivadas del canal:
// `UULF…` (videos largos), `UUSH…` (Shorts) y `UULV…` (directos). Son una
// convención no documentada: si una no existe, el plan B lee la playlist de
// subidas (`UU…`, documentada) y clasifica cada video por duración y por si
// fue un directo. Todo cuesta 1 unidad por llamada (nunca `search`, que cuesta 100).

export const YOUTUBE_API_HOST = "www.googleapis.com";
const API = `https://${YOUTUBE_API_HOST}/youtube/v3`;

const HANDLE = /^@[A-Za-z0-9._-]{3,30}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
/** Un Short dura hasta 3 minutos (regla de YouTube desde 2024). */
export const SHORT_MAX_SECONDS = 180;
const TITLE_MAX = 200;
/** Cuántos elementos se miran para saltear privados o directos en curso. */
const PAGE_SIZE = 10;
/** En el plan B, la playlist de subidas mezcla tipos: se mira más, por páginas. */
const FALLBACK_PAGE_SIZE = 50;
/**
 * Tope de páginas del plan B (200 subidas, hasta 8 unidades): un canal con
 * cientos de videos de un solo tipo no se come la cuota buscando el otro.
 */
const FALLBACK_MAX_PAGES = 4;

const PLAYLIST_PREFIX: Readonly<Record<FeaturedKind, string>> = {
  video: "UULF",
  short: "UUSH",
  stream: "UULV",
};

type Failure = ProviderError | "not_found";

/** Cuántos directos recientes de cada canal se miran (uno en curso suele ser el primero). */
const LIVE_CANDIDATES = 3;

export class YouTubeProvider implements FeaturedContentProvider, LiveStatusProvider {
  constructor(
    private readonly apiKey: string,
    private readonly safeFetch: SafeFetch,
    private readonly budget: QuotaBudget,
  ) {}

  async resolveChannel(handle: string): Promise<Result<string | null, ProviderError>> {
    if (CHANNEL_ID.test(handle)) return ok(handle);
    if (!HANDLE.test(handle)) return ok(null);
    const answer = await this.get("channels", { part: "id", forHandle: handle }, ChannelsResponse);
    if (!answer.ok) return answer.error === "not_found" ? ok(null) : err(answer.error);
    const id = answer.value.items?.[0]?.id;
    return ok(id !== undefined && CHANNEL_ID.test(id) ? id : null);
  }

  async latest(
    channelId: string,
    kind: FeaturedKind,
  ): Promise<Result<FeaturedVideo | null, ProviderError>> {
    if (!CHANNEL_ID.test(channelId)) return ok(null);
    const suffix = channelId.slice(2);
    const items = await this.playlist(PLAYLIST_PREFIX[kind] + suffix, PAGE_SIZE);
    if (!items.ok) {
      if (items.error !== "not_found") return err(items.error);
      return this.latestFromUploads(`UU${suffix}`, kind);
    }

    const candidates = items.value.items.filter(isPublic);
    if (kind !== "stream") {
      const first = candidates[0];
      return ok(first ? fromPlaylistItem(first, kind) : null);
    }
    // Un directo en curso o programado también está en `UULV`: se busca el
    // primero que ya terminó.
    const videos = await this.videos(candidates.map((item) => item.contentDetails.videoId));
    if (!videos.ok) return videos;
    const ended = videos.value.find((video) => video.liveStreamingDetails?.actualEndTime);
    return ok(ended ? fromVideo(ended, "stream") : null);
  }

  /**
   * En vivo: los últimos de `UULV…` de cada canal (1 unidad por canal) y sus
   * detalles en lotes de 50 (1 unidad por lote). En vivo = empezó y no terminó.
   */
  async checkLive(
    channels: readonly string[],
  ): Promise<Result<ReadonlyMap<string, LiveState>, ProviderError>> {
    const states = new Map<string, LiveState>(channels.map((channel) => [channel, OFFLINE]));
    const candidates = new Map<string, string>(); // video → canal
    for (const channel of new Set(channels)) {
      if (!CHANNEL_ID.test(channel)) continue;
      const items = await this.playlist(`UULV${channel.slice(2)}`, LIVE_CANDIDATES);
      if (!items.ok) {
        // Sin playlist de directos: el canal nunca transmitió.
        if (items.error === "not_found") continue;
        return err(items.error);
      }
      for (const item of items.value.items) candidates.set(item.contentDetails.videoId, channel);
    }

    const ids = [...candidates.keys()];
    for (let start = 0; start < ids.length; start += 50) {
      const videos = await this.videos(ids.slice(start, start + 50));
      if (!videos.ok) return videos;
      for (const video of videos.value) {
        const details = video.liveStreamingDetails;
        const live =
          video.snippet?.liveBroadcastContent === "live" &&
          details?.actualStartTime !== undefined &&
          details.actualEndTime === undefined;
        const channel = candidates.get(video.id);
        if (!live || !channel || states.get(channel)?.isLive) continue;
        states.set(channel, {
          isLive: true,
          title: video.snippet?.title.slice(0, TITLE_MAX) ?? null,
          startedAt: details.actualStartTime ?? null,
          url: `https://www.youtube.com/watch?v=${video.id}`,
        });
      }
    }
    return ok(states);
  }

  async video(videoId: string): Promise<Result<FeaturedVideo | null, ProviderError>> {
    if (!VIDEO_ID.test(videoId)) return ok(null);
    const videos = await this.videos([videoId]);
    if (!videos.ok) return videos;
    const [video] = videos.value;
    if (!video || video.status?.privacyStatus === "private") return ok(null);
    return ok(fromVideo(video, classify(video) ?? "video"));
  }

  /** Plan B: la playlist de subidas, clasificando cada video. */
  private async latestFromUploads(
    uploads: string,
    kind: FeaturedKind,
  ): Promise<Result<FeaturedVideo | null, ProviderError>> {
    let pageToken: string | undefined;
    for (let page = 0; page < FALLBACK_MAX_PAGES; page++) {
      const items = await this.playlist(uploads, FALLBACK_PAGE_SIZE, pageToken);
      if (!items.ok) return items.error === "not_found" ? ok(null) : err(items.error);
      const videos = await this.videos(
        items.value.items.filter(isPublic).map((item) => item.contentDetails.videoId),
      );
      if (!videos.ok) return videos;
      const match = videos.value.find((video) => classify(video) === kind);
      if (match) return ok(fromVideo(match, kind));
      pageToken = items.value.nextPageToken;
      if (!pageToken) break;
    }
    return ok(null);
  }

  private async playlist(
    playlistId: string,
    size: number,
    pageToken?: string,
  ): Promise<Result<{ items: readonly PlaylistItem[]; nextPageToken?: string }, Failure>> {
    const answer = await this.get(
      "playlistItems",
      {
        part: "snippet,contentDetails,status",
        playlistId,
        maxResults: String(size),
        ...(pageToken ? { pageToken } : {}),
      },
      PlaylistItemsResponse,
    );
    if (!answer.ok) return answer;
    const { items = [], nextPageToken } = answer.value;
    return ok(nextPageToken ? { items, nextPageToken } : { items });
  }

  /** Detalles de hasta 50 videos en una sola llamada (en el orden pedido). */
  private async videos(
    ids: readonly string[],
  ): Promise<Result<readonly VideoItem[], ProviderError>> {
    const valid = ids.filter((id) => VIDEO_ID.test(id)).slice(0, 50);
    if (valid.length === 0) return ok([]);
    const answer = await this.get(
      "videos",
      { part: "snippet,contentDetails,status,liveStreamingDetails", id: valid.join(",") },
      VideosResponse,
    );
    if (!answer.ok) return answer.error === "not_found" ? ok([]) : err(answer.error);
    const byId = new Map((answer.value.items ?? []).map((item) => [item.id, item]));
    return ok(valid.flatMap((id) => byId.get(id) ?? []));
  }

  private async get<T>(
    resource: string,
    params: Readonly<Record<string, string>>,
    schema: z.ZodType<T>,
  ): Promise<Result<T, Failure>> {
    if (!(await this.budget.tryConsume(1))) return err("budget_exhausted");
    const url = new URL(`${API}/${resource}`);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    // La key va en un header y no en la URL: así nunca aparece en un log de URLs.
    const response = await this.safeFetch(url, { headers: { "X-Goog-Api-Key": this.apiKey } });
    if (!response.ok) return err("unavailable");

    const { status, body } = response.value;
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return err(status >= 500 ? "unavailable" : "invalid_response");
    }
    if (status !== 200) return err(failureOf(status, json));
    const parsed = schema.safeParse(json);
    return parsed.success ? ok(parsed.data) : err("invalid_response");
  }
}

function failureOf(status: number, json: unknown): Failure {
  const parsed = ErrorResponse.safeParse(json);
  const reasons = parsed.success ? (parsed.data.error.errors ?? []).map((e) => e.reason) : [];
  if (status === 404) return "not_found";
  if (reasons.includes("quotaExceeded") || reasons.includes("dailyLimitExceeded")) {
    return "quota_exceeded";
  }
  if (status === 429 || reasons.includes("rateLimitExceeded")) return "rate_limited";
  return "unavailable";
}

function isPublic(item: PlaylistItem): boolean {
  return (item.status?.privacyStatus ?? "public") === "public";
}

/** Tipo de un video por sus datos: directo terminado, Short o largo. */
function classify(video: VideoItem): FeaturedKind | null {
  if (video.liveStreamingDetails) {
    return video.liveStreamingDetails.actualEndTime ? "stream" : null;
  }
  const seconds = parseIsoDuration(video.contentDetails?.duration);
  if (seconds === null || seconds === 0) return null;
  return seconds <= SHORT_MAX_SECONDS ? "short" : "video";
}

function fromPlaylistItem(item: PlaylistItem, kind: FeaturedKind): FeaturedVideo | null {
  const { videoId, videoPublishedAt } = item.contentDetails;
  const publishedAt = videoPublishedAt ?? item.snippet?.publishedAt;
  if (!VIDEO_ID.test(videoId) || !item.snippet || !publishedAt) return null;
  return {
    videoId,
    kind,
    title: item.snippet.title.slice(0, TITLE_MAX),
    publishedAt,
    durationSeconds: null,
  };
}

function fromVideo(video: VideoItem, kind: FeaturedKind): FeaturedVideo | null {
  if (!VIDEO_ID.test(video.id) || !video.snippet) return null;
  return {
    videoId: video.id,
    kind,
    title: video.snippet.title.slice(0, TITLE_MAX),
    publishedAt: video.snippet.publishedAt,
    durationSeconds: parseIsoDuration(video.contentDetails?.duration),
  };
}
