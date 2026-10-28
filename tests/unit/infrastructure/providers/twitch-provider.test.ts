import { describe, expect, it } from "vitest";

import { createSafeFetch } from "@/infrastructure/http/safe-fetch";
import { TWITCH_HOSTS, TwitchProvider } from "@/infrastructure/providers/twitch/twitch-provider";

// Lo propio de Twitch (lo común está en live-status-contract.test.ts): el token
// de aplicación, los lotes de 100 y los logins armados.

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function twitchServer(answer: (url: URL, init?: RequestInit) => Response) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const safeFetch = createSafeFetch({
    allowedHosts: [...TWITCH_HOSTS],
    fetcher: (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      calls.push({ url, ...(init ? { init } : {}) });
      return Promise.resolve(answer(url, init));
    },
  });
  return { safeFetch, calls };
}

const tokenOk = () => json(200, { access_token: "token-1", expires_in: 3600 });

describe("TwitchProvider", () => {
  it("pide el token una vez (POST con client credentials) y lo reusa", async () => {
    let now = 0;
    const { safeFetch, calls } = twitchServer((url) =>
      url.hostname === "id.twitch.tv" ? tokenOk() : json(200, { data: [] }),
    );
    const twitch = new TwitchProvider("cliente", "secreto", safeFetch, () => now);
    await twitch.checkLive(["uno"]);
    await twitch.checkLive(["dos"]);
    const tokenCalls = calls.filter((call) => call.url.hostname === "id.twitch.tv");
    expect(tokenCalls).toHaveLength(1);
    expect(tokenCalls[0]?.init?.method).toBe("POST");
    expect(formBody(tokenCalls[0]?.init?.body)).toBe(
      "client_id=cliente&client_secret=secreto&grant_type=client_credentials",
    );
    const streams = calls.find((call) => call.url.hostname === "api.twitch.tv");
    const headers = new Headers(streams?.init?.headers);
    expect(headers.get("Client-Id")).toBe("cliente");
    expect(headers.get("Authorization")).toBe("Bearer token-1");

    // Cerca de vencer, se renueva.
    now = 3600 * 1000;
    await twitch.checkLive(["tres"]);
    expect(calls.filter((call) => call.url.hostname === "id.twitch.tv")).toHaveLength(2);
  });

  it("con un 401 (token revocado) pide otro una sola vez", async () => {
    let streamsCalls = 0;
    const { safeFetch, calls } = twitchServer((url) => {
      if (url.hostname === "id.twitch.tv") return tokenOk();
      streamsCalls++;
      return json(401, { message: "Invalid OAuth token" });
    });
    const twitch = new TwitchProvider("cliente", "secreto", safeFetch);
    expect(await twitch.checkLive(["uno"])).toEqual({ ok: false, error: "unavailable" });
    expect(streamsCalls).toBe(2);
    expect(calls.filter((call) => call.url.hostname === "id.twitch.tv")).toHaveLength(2);
  });

  it("consulta de a 100 logins; uno armado no llega a la API", async () => {
    const { safeFetch, calls } = twitchServer((url) =>
      url.hostname === "id.twitch.tv" ? tokenOk() : json(200, { data: [] }),
    );
    const twitch = new TwitchProvider("cliente", "secreto", safeFetch);
    const logins = Array.from({ length: 150 }, (_, index) => `canal_${String(index)}`);
    const result = await twitch.checkLive([...logins, "../../x", "con espacio", "Mayus"]);
    const streams = calls.filter((call) => call.url.hostname === "api.twitch.tv");
    expect(streams.map((call) => call.url.searchParams.getAll("user_login").length)).toEqual([
      100, 51,
    ]);
    const asked = streams.flatMap((call) => call.url.searchParams.getAll("user_login"));
    expect(asked).not.toContain("../../x");
    expect(asked).toContain("mayus");
    if (result.ok) expect(result.value.get("../../x")?.isLive).toBe(false);
  });

  it("429 es rate_limited; un token que no llega, unavailable", async () => {
    const limited = twitchServer((url) =>
      url.hostname === "id.twitch.tv" ? tokenOk() : json(429, {}),
    );
    expect(await new TwitchProvider("c", "s", limited.safeFetch).checkLive(["uno"])).toEqual({
      ok: false,
      error: "rate_limited",
    });

    const noToken = twitchServer(() => json(403, { message: "invalid client secret" }));
    expect(await new TwitchProvider("c", "s", noToken.safeFetch).checkLive(["uno"])).toEqual({
      ok: false,
      error: "unavailable",
    });
  });
});

/** El formulario que viajó en el cuerpo del pedido. */
function formBody(body: RequestInit["body"] | undefined): string {
  return body instanceof URLSearchParams ? body.toString() : "";
}
