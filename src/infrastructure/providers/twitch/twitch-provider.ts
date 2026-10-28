import { z } from "zod";

import type { ProviderError } from "@/application/ports/featured-content-provider";
import {
  type LiveState,
  type LiveStatusProvider,
  OFFLINE,
} from "@/application/ports/live-status-provider";
import { err, ok, type Result } from "@/domain/result";
import type { SafeFetch } from "@/infrastructure/http/safe-fetch";

// En vivo de Twitch (SPEC-live-status, "Cómo se obtiene cada dato"): Helix
// `GET /streams` con hasta 100 logins por pedido y un token de aplicación
// (client credentials). Sin cuota en unidades; límite de 800 pedidos por minuto.

export const TWITCH_HOSTS = ["api.twitch.tv", "id.twitch.tv"] as const;
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const STREAMS_URL = "https://api.twitch.tv/helix/streams";
const LOGIN = /^[a-z0-9_]{1,25}$/;
const BATCH = 100;
/** El token se renueva un minuto antes de vencer. */
const TOKEN_MARGIN_MS = 60_000;

const TokenResponse = z.object({ access_token: z.string().min(1), expires_in: z.number() });
const StreamsResponse = z.object({
  data: z.array(
    z.object({
      user_login: z.string(),
      type: z.string(),
      title: z.string(),
      started_at: z.string(),
    }),
  ),
});

type Stream = z.infer<typeof StreamsResponse>["data"][number];

export class TwitchProvider implements LiveStatusProvider {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly safeFetch: SafeFetch,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async checkLive(
    channels: readonly string[],
  ): Promise<Result<ReadonlyMap<string, LiveState>, ProviderError>> {
    const states = new Map<string, LiveState>();
    const logins = [...new Set(channels.map((login) => login.toLowerCase()))].filter((login) =>
      LOGIN.test(login),
    );
    for (const channel of channels) states.set(channel, OFFLINE);

    for (let start = 0; start < logins.length; start += BATCH) {
      const batch = logins.slice(start, start + BATCH);
      const streams = await this.streams(batch);
      if (!streams.ok) return streams;
      for (const stream of streams.value) {
        if (stream.type !== "live") continue;
        const login = stream.user_login.toLowerCase();
        const state: LiveState = {
          isLive: true,
          title: stream.title.slice(0, 200),
          startedAt: stream.started_at,
          url: `https://www.twitch.tv/${login}`,
        };
        // Vuelve con la misma clave con que se pidió (puede venir con mayúsculas).
        for (const channel of channels) {
          if (channel.toLowerCase() === login) states.set(channel, state);
        }
      }
    }
    return ok(states);
  }

  private async streams(
    logins: readonly string[],
    retried = false,
  ): Promise<Result<readonly Stream[], ProviderError>> {
    const token = await this.accessToken();
    if (!token.ok) return token;
    const url = new URL(STREAMS_URL);
    for (const login of logins) url.searchParams.append("user_login", login);
    url.searchParams.set("first", String(BATCH));
    const response = await this.safeFetch(url, {
      headers: { "Client-Id": this.clientId, Authorization: `Bearer ${token.value}` },
    });
    if (!response.ok) return err("unavailable");
    const { status, body } = response.value;
    // Token vencido o revocado: se pide otro una sola vez.
    if (status === 401 && !retried) {
      this.token = null;
      return this.streams(logins, true);
    }
    if (status === 429) return err("rate_limited");
    if (status !== 200) return err("unavailable");
    const parsed = StreamsResponse.safeParse(parseJson(body));
    return parsed.success ? ok(parsed.data.data) : err("invalid_response");
  }

  private async accessToken(): Promise<Result<string, ProviderError>> {
    if (this.token && this.now() < this.token.expiresAt - TOKEN_MARGIN_MS) {
      return ok(this.token.value);
    }
    const response = await this.safeFetch(new URL(TOKEN_URL), {
      form: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "client_credentials",
      },
    });
    if (!response.ok || response.value.status !== 200) return err("unavailable");
    const parsed = TokenResponse.safeParse(parseJson(response.value.body));
    if (!parsed.success) return err("invalid_response");
    this.token = {
      value: parsed.data.access_token,
      expiresAt: this.now() + parsed.data.expires_in * 1000,
    };
    return ok(this.token.value);
  }
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
