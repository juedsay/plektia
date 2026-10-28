import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page, test } from "@playwright/test";

import { realPng } from "../support/png";
import { EXIF_SEGMENT, jpeg, PNG_SIGNATURE, SVG_WITH_SCRIPT, webp } from "../support/webp";
import { signIn } from "./support/session";

async function violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations.map((violation) => violation.id);
}

// Avatar (tarea 22a): la Action valida y guarda, la página pública lo muestra y
// `/avatars/...` lo sirve desde el propio sitio. El recorte en el navegador
// llega en la 22b; acá se manda el WebP ya recortado.
// Cuenta propia de estos tests (seed): los demás archivos corren en paralelo y
// cambian la página actual del miembro.
const AVATAR_EMAIL = "avatar@plektia.test";
const AVATAR_PAGE_ID = "44444444-4444-4444-8444-444444444444";

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
    await signIn(context, baseURL ?? "", AVATAR_EMAIL);
  });

  test.afterAll(async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL: baseURL ?? "" });
    await signIn(context, baseURL ?? "", AVATAR_EMAIL);
    await post(context.request, baseURL, "pages.removeAvatar", { pageId: AVATAR_PAGE_ID });
    await context.close();
  });

  for (const [description, bytes, name, mimeType] of [
    ["un SVG con un script", SVG_WITH_SCRIPT, "avatar.svg", "image/svg+xml"],
    ["un PNG renombrado", PNG_SIGNATURE, "foto.webp", "image/webp"],
  ] as const) {
    test(`rechaza ${description} junto al campo`, async ({ context, baseURL }) => {
      const response = await post(context.request, baseURL, "pages.setAvatar", {
        pageId: AVATAR_PAGE_ID,
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
      pageId: AVATAR_PAGE_ID,
      avatar: file(webp()),
    });
    expect(response.ok()).toBe(true);
    const path = /44444444-4444-4444-8444-444444444444\/[0-9a-f-]{36}\.webp/.exec(
      await response.text(),
    )?.[0];
    expect(path).toBeDefined();

    // En local la caché de la pública no se purga: se pide sin caché.
    await page.goto(`/avatar-demo?avatar=${String(Date.now())}`);
    await expect(page.locator(".identity img")).toHaveAttribute("src", `/avatars/${path ?? ""}`);

    const image = await context.request.get(`/avatars/${path ?? ""}`);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/webp");
    expect(image.headers()["x-content-type-options"]).toBe("nosniff");
    expect(image.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
    // Abierta sola, la imagen no puede correr ni cargar nada.
    expect(image.headers()["content-security-policy"]).toContain("sandbox");
    expect(image.headers()["content-security-policy"]).toContain("default-src 'none'");
    expect(new Uint8Array(await image.body())).toEqual(webp());
  });

  test("un JPEG (lo que genera Safari) se guarda como .jpg y se sirve como image/jpeg", async ({
    context,
    baseURL,
  }) => {
    const response = await post(context.request, baseURL, "pages.setAvatar", {
      pageId: AVATAR_PAGE_ID,
      avatar: file(jpeg(), "avatar.jpg", "image/jpeg"),
    });
    const path = /44444444-4444-4444-8444-444444444444\/[0-9a-f-]{36}\.jpg/.exec(
      await response.text(),
    )?.[0];
    expect(path).toBeDefined();
    const image = await context.request.get(`/avatars/${path ?? ""}`);
    expect(image.headers()["content-type"]).toBe("image/jpeg");
    expect(new Uint8Array(await image.body())).toEqual(jpeg());
  });

  test("un JPEG con EXIF (ubicación de la foto) se rechaza", async ({ context, baseURL }) => {
    const response = await post(context.request, baseURL, "pages.setAvatar", {
      pageId: AVATAR_PAGE_ID,
      avatar: file(jpeg({ before: EXIF_SEGMENT }), "foto.jpg", "image/jpeg"),
    });
    expect(await response.text()).toContain("datos de la cámara o la ubicación");
  });

  test("un envío de más de 256 KB se corta antes de llegar a la Action (413)", async ({
    context,
    baseURL,
  }) => {
    const response = await post(context.request, baseURL, "pages.setAvatar", {
      pageId: AVATAR_PAGE_ID,
      avatar: file(new Uint8Array(1024 * 1024)),
    });
    expect(response.status()).toBe(413);
  });

  test("una ruta que no es de avatar no llega a Storage", async ({ request }) => {
    for (const path of ["/avatars/x/y.webp", "/avatars/..%2F..%2Fauth/v1/x.webp"]) {
      expect((await request.get(path)).status()).toBe(404);
    }
  });

  test("desde /admin/page: elegir una foto, recortarla con el teclado y guardarla", async ({
    page,
  }) => {
    await page.goto("/admin/page");
    // El editor se carga aparte: se espera a que esté conectado.
    await expect(page.locator("[data-avatar-editor][data-ready]")).toBeAttached();
    await page.getByLabel("Elegir foto").setInputFiles({
      name: "foto.png",
      mimeType: "image/png",
      buffer: realPng(900, 600),
    });
    const crop = page.getByLabel("Recorte de la foto");
    await expect(crop).toBeVisible();
    await expect(crop).toBeFocused();
    await page.keyboard.press("+");
    await page.keyboard.press("ArrowLeft");
    expect(Number(await page.getByLabel("Zoom").inputValue())).toBeGreaterThan(1);
    expect(await violations(page)).toEqual([]);

    await page.getByRole("button", { name: "Guardar avatar" }).click();
    await page.waitForURL(/\/admin\/page\?avatar$/);
    await expect(page.getByText("Avatar guardado")).toBeVisible();
    const current = page.getByRole("img", { name: "Tu avatar actual" });
    await expect(current).toHaveAttribute(
      "src",
      /^\/avatars\/44444444-[0-9a-f-]+\/[0-9a-f-]{36}\.webp$/,
    );
    // La imagen re-codificada se decodifica de verdad, de 512 × 512.
    await expect
      .poll(() => current.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBe(512);
  });

  test("si la red se corta al guardar, avisa y deja reintentar", async ({ page }) => {
    await page.goto("/admin/page");
    await expect(page.locator("[data-avatar-editor][data-ready]")).toBeAttached();
    await page.getByLabel("Elegir foto").setInputFiles({
      name: "foto.png",
      mimeType: "image/png",
      buffer: realPng(600, 600),
    });
    const isUpload = (url: URL) => url.pathname.includes("pages.setAvatar");
    await page.route(isUpload, (route) => route.abort("internetdisconnected"));
    const save = page.getByRole("button", { name: "Guardar avatar" });
    await save.click();
    await expect(page.getByRole("alert")).toHaveText(/No pudimos guardar la foto/);
    await expect(save).toBeEnabled();

    await page.unroute(isUpload);
    await save.click();
    await page.waitForURL(/\/admin\/page\?avatar$/);
  });

  test("el editor rechaza una foto disfrazada o demasiado pesada sin subir nada", async ({
    page,
  }) => {
    await page.goto("/admin/page");
    // El editor se carga aparte: se espera a que esté conectado.
    await expect(page.locator("[data-avatar-editor][data-ready]")).toBeAttached();
    const choose = page.getByLabel("Elegir foto");
    await choose.setInputFiles({
      name: "foto.png",
      mimeType: "image/png",
      buffer: Buffer.from(SVG_WITH_SCRIPT),
    });
    await expect(page.getByRole("alert")).toHaveText(/No pudimos leer la foto/);
    await expect(page.getByLabel("Recorte de la foto")).toBeHidden();

    await choose.setInputFiles({
      name: "enorme.png",
      mimeType: "image/png",
      buffer: Buffer.concat([realPng(200, 200), Buffer.alloc(6 * 1024 * 1024)]),
    });
    await expect(page.getByRole("alert")).toHaveText(/pesa más de 5 MB/);
  });

  test("sacar el avatar vuelve a la inicial", async ({ context, baseURL, page }) => {
    const response = await post(context.request, baseURL, "pages.removeAvatar", {
      pageId: AVATAR_PAGE_ID,
    });
    expect(response.ok()).toBe(true);
    await page.goto(`/avatar-demo?sin-avatar=${String(Date.now())}`);
    await expect(page.locator(".identity img")).toHaveCount(0);
    await expect(page.locator(".identity .avatar")).toHaveText("A");
  });
});
