import { expect, type APIRequestContext, test } from "@playwright/test";

import { PNG_SIGNATURE, SVG_WITH_SCRIPT, webp } from "../support/webp";
import { signIn } from "./support/session";

// Avatar (tarea 22a): la Action valida y guarda, la página pública lo muestra y
// `/avatars/...` lo sirve desde el propio sitio. El recorte en el navegador
// llega en la 22b; acá se manda el WebP ya recortado.
const MEMBER_PAGE_ID = "22222222-2222-4222-8222-222222222222";

test.describe.configure({ mode: "serial" });

function post(
  request: APIRequestContext,
  baseURL: string | undefined,
  action: string,
  multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }>,
) {
  return request.post(`/_actions/${action}`, { multipart, headers: { origin: baseURL ?? "" } });
}

const file = (bytes: Uint8Array, name = "avatar.webp", mimeType = "image/webp") => ({
  name,
  mimeType,
  buffer: Buffer.from(bytes),
});

test.describe("avatar", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL ?? "", "member@plektia.test");
  });

  test.afterAll(async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL: baseURL ?? "" });
    await signIn(context, baseURL ?? "", "member@plektia.test");
    await post(context.request, baseURL, "pages.removeAvatar", { pageId: MEMBER_PAGE_ID });
    await context.close();
  });

  for (const [description, bytes, name, mimeType] of [
    ["un SVG con un script", SVG_WITH_SCRIPT, "avatar.svg", "image/svg+xml"],
    ["un PNG renombrado", PNG_SIGNATURE, "foto.webp", "image/webp"],
  ] as const) {
    test(`rechaza ${description} junto al campo`, async ({ context, baseURL }) => {
      const response = await post(context.request, baseURL, "pages.setAvatar", {
        pageId: MEMBER_PAGE_ID,
        avatar: file(bytes, name, mimeType),
      });
      expect(await response.text()).toContain("No pudimos leer la imagen");
    });
  }

  test("un WebP válido se ve en la página pública y se sirve desde el propio sitio", async ({
    context,
    baseURL,
    page,
  }) => {
    const response = await post(context.request, baseURL, "pages.setAvatar", {
      pageId: MEMBER_PAGE_ID,
      avatar: file(webp()),
    });
    expect(response.ok()).toBe(true);
    const path = /22222222-2222-4222-8222-222222222222\/[0-9a-f-]{36}\.webp/.exec(
      await response.text(),
    )?.[0];
    expect(path).toBeDefined();

    // En local la caché de la pública no se purga: se pide sin caché.
    await page.goto(`/miembro-demo?avatar=${String(Date.now())}`);
    await expect(page.locator(".identity img")).toHaveAttribute("src", `/avatars/${path ?? ""}`);

    const image = await context.request.get(`/avatars/${path ?? ""}`);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/webp");
    expect(image.headers()["x-content-type-options"]).toBe("nosniff");
    expect(image.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(new Uint8Array(await image.body())).toEqual(webp());
  });

  test("una ruta que no es de avatar no llega a Storage", async ({ request }) => {
    for (const path of ["/avatars/x/y.webp", "/avatars/..%2F..%2Fauth/v1/x.webp"]) {
      expect((await request.get(path)).status()).toBe(404);
    }
  });

  test("sacar el avatar vuelve a la inicial", async ({ context, baseURL, page }) => {
    const response = await post(context.request, baseURL, "pages.removeAvatar", {
      pageId: MEMBER_PAGE_ID,
    });
    expect(response.ok()).toBe(true);
    await page.goto(`/miembro-demo?sin-avatar=${String(Date.now())}`);
    await expect(page.locator(".identity img")).toHaveCount(0);
    await expect(page.locator(".identity .avatar")).toHaveText("M");
  });
});
