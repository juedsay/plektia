import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

import { signIn } from "./support/session";

// Código QR de una página: lo sirve /{handle}/qr.svg, lo muestran la ventana
// de compartir de la página pública y el Inicio del panel (con descarga).
test.use({
  extraHTTPHeaders: { "cf-connecting-ip": `2001:db8:11::${randomBytes(2).toString("hex")}` },
});

test("el QR de una página es un SVG propio, cacheable y que no corre nada", async ({ request }) => {
  const response = await request.get("/miembro-demo/qr.svg");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
  expect(response.headers()["content-security-policy"]).toContain("sandbox");
  const body = await response.text();
  expect(body).toMatch(/^<svg /);
  expect(body).not.toMatch(/<script|href=/i);

  const download = await request.get("/miembro-demo/qr.svg?descargar");
  expect(download.headers()["content-disposition"]).toContain(
    'attachment; filename="plektia-miembro-demo-qr.svg"',
  );

  // La página oficial también tiene el suyo; una que no existe, no.
  expect((await request.get("/plektia/qr.svg")).status()).toBe(200);
  expect((await request.get("/no-existe-nadie/qr.svg")).status()).toBe(404);
});

test("la ventana de compartir muestra el QR recién al abrirlo", async ({ page }) => {
  await page.goto("/miembro-demo");
  await page.getByRole("button", { name: "Compartir esta página" }).click();
  const dialog = page.getByRole("dialog", { name: "Compartir" });
  const image = dialog.getByRole("img", { name: /Código QR/ });
  await expect(image).toBeHidden();

  await dialog.getByText("Código QR", { exact: true }).click();
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0);
  await expect(dialog.getByRole("link", { name: "Descargar" })).toHaveAttribute(
    "href",
    "/miembro-demo/qr.svg?descargar",
  );
});

test("las páginas del sitio no ofrecen QR", async ({ page }) => {
  await page.goto("/legal/privacy");
  await page.getByRole("button", { name: "Compartir esta página" }).click();
  await expect(
    page.getByRole("dialog", { name: "Compartir" }).getByText("Código QR", { exact: true }),
  ).toHaveCount(0);
});

test("en el panel se ve el QR y se descarga en PNG", async ({ page, context, baseURL }) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await page.goto("/admin");
  await page.getByText("Código QR", { exact: true }).click();
  const image = page.getByRole("img", { name: /Código QR/ });
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0);

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PNG" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("plektia-avatar-demo-qr.png");
});
