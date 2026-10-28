import { describe, expect, it } from "vitest";

import { createSafeFetch } from "@/infrastructure/http/safe-fetch";

const HOST = "www.googleapis.com";

function safeFetchWith(
  respond: (url: URL, init?: RequestInit) => Promise<Response>,
  options: { timeoutMs?: number; maxBytes?: number } = {},
) {
  const requested: URL[] = [];
  const safeFetch = createSafeFetch({
    allowedHosts: [HOST],
    ...options,
    fetcher: (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      requested.push(url);
      return respond(url, init);
    },
  });
  return { safeFetch, requested };
}

describe("safeFetch", () => {
  it("devuelve el estado y el cuerpo; no sigue redirecciones", async () => {
    let seenInit: RequestInit | undefined;
    const { safeFetch } = safeFetchWith((_url, init) => {
      seenInit = init;
      return Promise.resolve(new Response('{"items":[]}', { status: 200 }));
    });
    expect(await safeFetch(new URL(`https://${HOST}/youtube/v3/channels`))).toEqual({
      ok: true,
      value: { status: 200, body: '{"items":[]}' },
    });
    expect(seenInit?.redirect).toBe("manual");
    expect(seenInit?.method).toBe("GET");
  });

  it.each([
    "https://evil.com/youtube/v3/channels",
    `http://${HOST}/youtube/v3/channels`,
    `https://${HOST}.evil.com/`,
    `https://user:pass@${HOST}/`,
    `https://${HOST}:8443/`,
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/",
  ])("rechaza %s sin hacer el pedido", async (url) => {
    const { safeFetch, requested } = safeFetchWith(() =>
      Promise.resolve(new Response("{}", { status: 200 })),
    );
    expect(await safeFetch(new URL(url))).toEqual({ ok: false, error: "host_not_allowed" });
    expect(requested).toEqual([]);
  });

  it("una redirección es un error", async () => {
    const { safeFetch } = safeFetchWith(() =>
      Promise.resolve(
        new Response(null, { status: 302, headers: { location: "https://169.254.169.254/" } }),
      ),
    );
    expect(await safeFetch(new URL(`https://${HOST}/`))).toEqual({ ok: false, error: "redirect" });
  });

  it("corta una respuesta enorme, aunque no declare su tamaño", async () => {
    const big = "x".repeat(2048);
    const declared = safeFetchWith(
      () =>
        Promise.resolve(new Response(big, { headers: { "content-length": String(big.length) } })),
      { maxBytes: 1024 },
    );
    expect(await declared.safeFetch(new URL(`https://${HOST}/`))).toEqual({
      ok: false,
      error: "too_large",
    });

    const streamed = safeFetchWith(
      () => {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            for (let chunk = 0; chunk < 4; chunk++) {
              controller.enqueue(new TextEncoder().encode("y".repeat(512)));
            }
            controller.close();
          },
        });
        return Promise.resolve(new Response(stream));
      },
      { maxBytes: 1024 },
    );
    expect(await streamed.safeFetch(new URL(`https://${HOST}/`))).toEqual({
      ok: false,
      error: "too_large",
    });
  });

  it("una respuesta lenta da timeout; un corte de red, network", async () => {
    const slow = safeFetchWith(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(init.signal?.reason as Error);
          });
        }),
      { timeoutMs: 20 },
    );
    expect(await slow.safeFetch(new URL(`https://${HOST}/`))).toEqual({
      ok: false,
      error: "timeout",
    });

    const broken = safeFetchWith(() => Promise.reject(new TypeError("fetch failed")));
    expect(await broken.safeFetch(new URL(`https://${HOST}/`))).toEqual({
      ok: false,
      error: "network",
    });
  });
});
