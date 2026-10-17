import { describe, expect, it, vi } from "vitest";

import { TurnstileVerifier } from "@/infrastructure/cloudflare/turnstile-verifier";

const answering = (body: unknown, status = 200) =>
  vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

describe("TurnstileVerifier", () => {
  it("manda el secreto, el token y la IP a Cloudflare", async () => {
    const fetcher = answering({ success: true, hostname: "app.plektia.workers.dev" });
    const verifier = new TurnstileVerifier("secreto", fetcher);
    expect(await verifier.verify("tok", "203.0.113.7")).toBe(true);

    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({
      secret: "secreto",
      response: "tok",
      remoteip: "203.0.113.7",
      idempotency_key: expect.any(String) as string,
    });
  });

  it("sin IP no la manda", async () => {
    const fetcher = answering({ success: true });
    await new TurnstileVerifier("s", fetcher).verify("tok", null);
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty("remoteip");
  });

  it.each([
    [
      "Cloudflare dice que no",
      answering({ success: false, "error-codes": ["invalid-input-response"] }),
    ],
    ["respuesta con otra forma", answering({ ok: true })],
    ["error HTTP", answering({ success: true }, 500)],
    ["error de red en los dos intentos", vi.fn(() => Promise.reject(new Error("caída")))],
  ])("falla cerrado: %s", async (_caso, fetcher) => {
    expect(await new TurnstileVerifier("s", fetcher).verify("t", null)).toBe(false);
  });

  it("sin secreto configurado no verifica a nadie (ni llama a Cloudflare)", async () => {
    const fetcher = answering({ success: true });
    expect(await new TurnstileVerifier("", fetcher).verify("t", null)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("si el primer intento se corta, reintenta una vez con la misma clave de idempotencia", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException("tardó", "TimeoutError"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
    expect(await new TurnstileVerifier("s", fetcher).verify("tok", null)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const keys = fetcher.mock.calls.map(
      ([, init]) =>
        (JSON.parse(init?.body as string) as { idempotency_key: string }).idempotency_key,
    );
    expect(keys[0]).toBe(keys[1]);
  });

  it("una respuesta negativa no se reintenta", async () => {
    const fetcher = answering({ success: false });
    await new TurnstileVerifier("s", fetcher).verify("tok", null);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
