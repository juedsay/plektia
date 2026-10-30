import { describe, expect, it } from "vitest";

import { createOpenWebFetch, isOpenWebTarget } from "@/infrastructure/http/open-web-fetch";

const OPTIONS = { blockedHosts: ["app.plektia.workers.dev"], blockedDomains: ["workers.dev"] };
const HTML = { accept: "text/html", types: ["text/html"], maxBytes: 1024 };

describe("isOpenWebTarget", () => {
  it.each([
    "https://medium.com/@juedsay/nota",
    "https://blog.ejemplo.com.ar/post",
    "https://ejemplo.com:443/nota",
  ])("deja pedir %s", (url) => {
    expect(isOpenWebTarget(new URL(url), OPTIONS)).toBe(true);
  });

  it.each([
    ["http://ejemplo.com/", "sin https"],
    ["https://usuario:clave@ejemplo.com/", "con credenciales"],
    ["https://ejemplo.com:8443/", "otro puerto"],
    ["https://127.0.0.1/", "IPv4"],
    ["https://2130706433/", "IPv4 en decimal"],
    ["https://0x7f.1/", "IPv4 en hexa"],
    ["https://[::1]/", "IPv6"],
    ["https://localhost/", "localhost"],
    ["https://intranet/", "nombre sin punto"],
    ["https://router.local/", ".local"],
    ["https://db.internal/", ".internal"],
    ["https://app.localhost/", ".localhost"],
    ["https://sitio.test/", ".test"],
    ["https://1.0.0.127.in-addr.arpa/", ".arpa"],
    ["https://app.plektia.workers.dev/", "el propio sitio"],
    ["https://otro.workers.dev/", "workers.dev"],
    ["https://ejemplo.com./", "con punto final, pero bien"],
  ])("%s (%s)", (url, reason) => {
    const allowed = reason === "con punto final, pero bien";
    expect(isOpenWebTarget(new URL(url), OPTIONS)).toBe(allowed);
  });
});

/** Un servidor falso: cada URL responde lo que diga el mapa. */
function server(routes: Record<string, () => Response>) {
  const requested: { url: string; init: RequestInit | undefined }[] = [];
  const fetcher = ((input: URL | RequestInfo, init?: RequestInit) => {
    // El fetch de la web abierta siempre pide con un `URL`.
    const url = (input as URL).href;
    requested.push({ url, init });
    const route = routes[url];
    return Promise.resolve(route ? route() : new Response("no", { status: 404 }));
  }) as typeof fetch;
  return { fetcher, requested };
}

const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { headers: { "content-type": "text/html; charset=utf-8", ...headers } });
const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

describe("createOpenWebFetch", () => {
  it("pide sin cookies ni credenciales, con su User-Agent, y devuelve la página", async () => {
    const { fetcher, requested } = server({
      "https://ejemplo.com/nota": () => html("<title>Hola</title>"),
    });
    const fetchPage = createOpenWebFetch({ ...OPTIONS, userAgent: "PlektiaPreview", fetcher });
    const result = await fetchPage(new URL("https://ejemplo.com/nota"), HTML);

    expect(result.ok && new TextDecoder().decode(result.value.bytes)).toBe("<title>Hola</title>");
    const init = requested[0]?.init;
    expect(init?.credentials).toBe("omit");
    expect(init?.redirect).toBe("manual");
    expect(init?.headers).toEqual({ Accept: "text/html", "User-Agent": "PlektiaPreview" });
  });

  it("sigue hasta 3 redirecciones y valida cada destino", async () => {
    const { fetcher } = server({
      "https://a.com/": () => redirect("https://b.com/"),
      "https://b.com/": () => redirect("/c"),
      "https://b.com/c": () => html("ok"),
    });
    const fetchPage = createOpenWebFetch({ ...OPTIONS, userAgent: "x", fetcher });
    const result = await fetchPage(new URL("https://a.com/"), HTML);
    expect(result.ok && result.value.finalUrl.href).toBe("https://b.com/c");
  });

  it("una redirección hacia un host interno se corta antes de pedirlo", async () => {
    const { fetcher, requested } = server({
      "https://a.com/": () => redirect("https://127.0.0.1/admin"),
    });
    const fetchPage = createOpenWebFetch({ ...OPTIONS, userAgent: "x", fetcher });
    expect(await fetchPage(new URL("https://a.com/"), HTML)).toEqual({
      ok: false,
      error: "blocked",
    });
    expect(requested.map((request) => request.url)).toEqual(["https://a.com/"]);
  });

  it("más de 3 redirecciones es un error", async () => {
    const { fetcher } = server({
      "https://a.com/1": () => redirect("/2"),
      "https://a.com/2": () => redirect("/3"),
      "https://a.com/3": () => redirect("/4"),
      "https://a.com/4": () => redirect("/5"),
    });
    const fetchPage = createOpenWebFetch({ ...OPTIONS, userAgent: "x", fetcher });
    expect(await fetchPage(new URL("https://a.com/1"), HTML)).toEqual({
      ok: false,
      error: "too_many_redirects",
    });
  });

  it("solo acepta el tipo esperado", async () => {
    const { fetcher } = server({
      "https://a.com/": () =>
        new Response("{}", { headers: { "content-type": "application/json" } }),
    });
    const fetchPage = createOpenWebFetch({ ...OPTIONS, userAgent: "x", fetcher });
    expect(await fetchPage(new URL("https://a.com/"), HTML)).toEqual({
      ok: false,
      error: "wrong_type",
    });
  });

  it("corta un cuerpo más grande que el máximo, aunque no lo declare", async () => {
    const { fetcher } = server({ "https://a.com/": () => html("x".repeat(2048)) });
    const fetchPage = createOpenWebFetch({ ...OPTIONS, userAgent: "x", fetcher });
    expect(await fetchPage(new URL("https://a.com/"), HTML)).toEqual({
      ok: false,
      error: "too_large",
    });
  });

  it("un error del sitio o un tiempo agotado no rompen nada", async () => {
    const { fetcher } = server({ "https://a.com/": () => new Response("x", { status: 500 }) });
    const failing = createOpenWebFetch({ ...OPTIONS, userAgent: "x", fetcher });
    expect(await failing(new URL("https://a.com/"), HTML)).toEqual({
      ok: false,
      error: "http_error",
    });

    const slow = createOpenWebFetch({
      ...OPTIONS,
      userAgent: "x",
      timeoutMs: 10,
      fetcher: ((_input: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("tarde", "TimeoutError"));
          });
        })),
    });
    expect(await slow(new URL("https://a.com/"), HTML)).toEqual({ ok: false, error: "timeout" });
  });
});
