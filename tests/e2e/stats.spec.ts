import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

import { createPageAs, deletePage, insertLink, signIn, statsToday } from "./support/session";

// Estadísticas sin cookies (tarea 27, SPEC-click-analytics). Una página propia
// de la cuenta del avatar, que ningún otro archivo visita, y una IP propia
// por bloque (el límite es por IP: así no comparte cupo con otros archivos).
const AVATAR_ID = "44444444-4444-4444-8444-444444444444";
const PAGE_ID = "5a7a0000-0000-4000-8000-0000000000e2";
const HANDLE = "e2e-estadisticas";
const ipOfThisRun = () => `2001:db8:5a::${randomBytes(2).toString("hex")}`;

let linkId: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await deletePage(PAGE_ID);
  await createPageAs("avatar@plektia.test", PAGE_ID, HANDLE);
  linkId = await insertLink(AVATAR_ID, PAGE_ID, {
    title: "Destino de prueba",
    url: "https://example.com/destino",
    provider: "generic",
    provider_handle: null,
  });
});

test.afterAll(async () => {
  await deletePage(PAGE_ID);
});

test.describe("medición", () => {
  test.use({ extraHTTPHeaders: { "cf-connecting-ip": ipOfThisRun() } });

  test("una visita suma; el aviso solo lleva t, h y s, sin cookies", async ({ page }) => {
    const before = await statsToday(PAGE_ID, linkId);
    const beacon = page.waitForRequest((request) => request.url().endsWith("/api/e"));
    await page.goto(`/${HANDLE}`);
    const request = await beacon;

    expect(Object.keys(request.postDataJSON() as object).sort()).toEqual(["h", "s", "t"]);
    expect(request.postDataJSON()).toEqual({ t: "view", h: HANDLE, s: "direct" });
    expect(request.headers()["cookie"]).toBeUndefined();
    await expect.poll(async () => (await statsToday(PAGE_ID, linkId)).views).toBe(before.views + 1);
  });

  test("tocar un link suma un clic y la navegación no espera", async ({ page }) => {
    // El destino es externo: se corta acá para no salir a internet.
    await page.route("https://example.com/**", (route) =>
      route.fulfill({ status: 200, body: "destino" }),
    );
    const before = await statsToday(PAGE_ID, linkId);
    await page.goto(`/${HANDLE}`);
    const beacon = page.waitForRequest(
      (request) =>
        request.url().endsWith("/api/e") && request.postData()?.includes('"click"') === true,
    );
    await page.getByRole("link", { name: /Destino de prueba/ }).click();
    const request = await beacon;

    expect(request.postDataJSON()).toEqual({ t: "click", l: linkId, s: "direct" });
    await expect(page).toHaveURL("https://example.com/destino");
    await expect
      .poll(async () => (await statsToday(PAGE_ID, linkId)).linkClicks)
      .toBe(before.linkClicks + 1);
  });

  test("el endpoint responde 204 (exista o no) y no cuenta lo inválido ni lo de otro sitio", async ({
    request,
    baseURL,
  }) => {
    const before = await statsToday(PAGE_ID, linkId);
    const send = (data: string, headers: Record<string, string>) =>
      request.post("/api/e", { data, headers });
    const view = JSON.stringify({ t: "view", h: HANDLE, s: "direct" });
    const sameSite = { origin: baseURL ?? "", "content-type": "text/plain" };

    expect(
      (
        await send(JSON.stringify({ t: "view", h: "no-existe-esta", s: "direct" }), sameSite)
      ).status(),
    ).toBe(204);
    expect(
      (
        await send(JSON.stringify({ t: "view", h: HANDLE, s: "direct", ip: "x" }), sameSite)
      ).status(),
    ).toBe(204);
    expect((await send("x".repeat(600), sameSite)).status()).toBe(204);
    expect((await request.get("/api/e")).status()).toBe(204);
    // Desde otro sitio lo frena antes Astro (`checkOrigin`): ni llega al endpoint.
    // Al final: en el servidor local, ese 403 deja la conexión inservible.
    expect((await send(view, { ...sameSite, origin: "https://evil.example" })).status()).toBe(403);
    expect((await statsToday(PAGE_ID, linkId)).views).toBe(before.views);
  });
});

test.describe("el dueño", () => {
  test.use({ extraHTTPHeaders: { "cf-connecting-ip": ipOfThisRun() } });

  test("con sesión, sus visitas a su propia página no cuentan", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL ?? "", "avatar@plektia.test");
    const before = await statsToday(PAGE_ID, linkId);
    const answered = page.waitForResponse((response) => response.url().endsWith("/api/e"));
    await page.goto(`/${HANDLE}`);
    expect((await answered).status()).toBe(204);
    expect((await statsToday(PAGE_ID, linkId)).views).toBe(before.views);
  });
});

test.describe("límite", () => {
  test.use({ extraHTTPHeaders: { "cf-connecting-ip": ipOfThisRun() } });

  test("100 eventos seguidos desde una IP registran 30 o menos", async ({ request, baseURL }) => {
    const before = await statsToday(PAGE_ID, linkId);
    const view = JSON.stringify({ t: "view", h: HANDLE, s: "direct" });
    for (let index = 0; index < 100; index++) {
      await request.post("/api/e", {
        data: view,
        headers: { origin: baseURL ?? "", "content-type": "text/plain" },
      });
    }
    const added = (await statsToday(PAGE_ID, linkId)).views - before.views;
    expect(added).toBeGreaterThan(0);
    expect(added).toBeLessThanOrEqual(30);
  });
});
