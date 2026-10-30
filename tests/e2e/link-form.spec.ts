import { randomBytes } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { deleteLinksTitled, insertLink, signIn } from "./support/session";

// Agregar un link eligiendo la red y escribiendo el usuario (SPEC-link-form, 7a).
// Cuenta del avatar (/avatar-demo), con un título propio para limpiar al final.
test.use({
  extraHTTPHeaders: { "cf-connecting-ip": `2001:db8:0f::${randomBytes(2).toString("hex")}` },
});

const AVATAR_ID = "44444444-4444-4444-8444-444444444444";
const TITLE = "Instagram por usuario";

test("con la red elegida, alcanza el usuario para agregar el perfil", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  try {
    await page.goto("/admin");
    const add = page.locator("form.add-link");
    await add.getByRole("button", { name: "Instagram", exact: true }).click();
    await add.getByLabel("Usuario de Instagram").fill("@plektia.demo");
    await expect(add.getByText("Se va a abrir instagram.com/plektia.demo")).toBeVisible();
    await add.getByLabel("Título").fill(TITLE);
    const results = await new AxeBuilder({ page }).include("form.add-link").analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
    await add.getByRole("button", { name: "Agregar link" }).click();
    await expect(page.locator("[data-editor-status]")).toHaveText(`${TITLE}: agregado`);

    const visitor = await (await browser.newContext({ baseURL: baseURL ?? "" })).newPage();
    await visitor.goto("/avatar-demo");
    const link = visitor.getByRole("link", { name: new RegExp(TITLE) });
    await expect(link).toHaveAttribute("href", "https://www.instagram.com/plektia.demo");
    await expect(link).toContainText("@plektia.demo");
    await visitor.context().close();
  } finally {
    await deleteLinksTitled(AVATAR_ID, [TITLE]);
  }
});

// Tipo de link (SPEC-link-form, 7b): un artículo se distingue en la página.
const ARTICLE_TITLE = "Nota de prueba";

test("un artículo se detecta al agregarlo y la página lo dice", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  try {
    await page.goto("/admin");
    const add = page.locator("form.add-link");
    await add.getByLabel("URL").fill("https://medium.com/@plektia/como-armar-tu-pagina");
    await expect(add.getByLabel("Tipo")).toContainText("Automático (Artículo)");
    await add.getByLabel("Título").fill(ARTICLE_TITLE);
    await add.getByRole("button", { name: "Agregar link" }).click();
    await expect(page.locator("[data-editor-status]")).toHaveText(`${ARTICLE_TITLE}: agregado`);

    const visitor = await (await browser.newContext({ baseURL: baseURL ?? "" })).newPage();
    await visitor.goto("/avatar-demo");
    await expect(visitor.getByRole("link", { name: new RegExp(ARTICLE_TITLE) })).toContainText(
      "Artículo · medium.com/@plektia/como-armar-tu-pagina",
    );
    await visitor.context().close();
  } finally {
    await deleteLinksTitled(AVATAR_ID, [ARTICLE_TITLE]);
  }
});

// Vista previa (SPEC-link-form, 7c-1): el recorrido completo hasta el servidor,
// que rechaza un destino que no es un sitio público (acá, un dominio `.test`).
test("'Traer vista previa' no visita un sitio que no es público", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await page.goto("/admin");
  const add = page.locator("form.add-link");
  await add.getByLabel("URL").fill("https://intranet.test/blog/notas-internas");
  await add.getByLabel("Título").fill("Nota interna");
  await add.getByRole("button", { name: "Traer vista previa" }).click();
  await expect(add.getByRole("status")).toHaveText(
    "Esa dirección no es un sitio público: no podemos traer su vista previa.",
  );
  await expect(add.getByLabel("Título")).toHaveValue("Nota interna");
});

// Imagen de la vista previa (SPEC-link-form, 7c-2): una imagen re-codificada en
// el navegador se guarda, la página pública la sirve desde el propio sitio, y
// sacarla la borra. (Traerla de un sitio real lo cubren los unit tests.)
const IMAGE_TITLE = "Nota con imagen";

test("la imagen de la vista previa se guarda, se ve en la página y se puede sacar", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const linkId = await insertLink(AVATAR_ID, AVATAR_ID, {
    title: IMAGE_TITLE,
    url: "https://medium.com/@plektia/una-nota-con-imagen",
    provider: "generic",
    provider_handle: null,
  });
  try {
    await signIn(context, baseURL ?? "", "avatar@plektia.test");
    await page.goto("/admin");
    // Una imagen real de 480 × 252, como la que arma el panel.
    const encoded = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 252;
      const drawing = canvas.getContext("2d");
      if (!drawing) throw new Error("sin canvas");
      drawing.fillStyle = "#2e5200";
      drawing.fillRect(0, 0, 480, 252);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/webp", 0.8);
      });
      if (!blob) throw new Error("sin imagen");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { type: blob.type, bytes: Array.from(bytes) };
    });
    const saved = await context.request.post("/_actions/links.setPreviewImage", {
      headers: { origin: baseURL ?? "" },
      multipart: {
        pageId: AVATAR_ID,
        id: linkId,
        version: "1",
        image: {
          name: "preview.webp",
          mimeType: encoded.type,
          buffer: Buffer.from(encoded.bytes),
        },
      },
    });
    expect(saved.ok()).toBe(true);

    const visitor = await (await browser.newContext({ baseURL: baseURL ?? "" })).newPage();
    await visitor.goto("/avatar-demo");
    const thumb = visitor
      .getByRole("link", { name: new RegExp(IMAGE_TITLE) })
      .locator("img.preview-thumb");
    const src = await thumb.getAttribute("src");
    expect(src).toMatch(/^\/link-previews\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/);
    const served = await visitor.request.get(src ?? "");
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toBe("image/webp");
    await visitor.context().close();

    await page.reload();
    await page.getByRole("button", { name: `Editar ${IMAGE_TITLE}` }).click();
    await page.getByRole("button", { name: `Sacar imagen de ${IMAGE_TITLE}` }).click();
    await expect(page.locator("[data-editor-status]")).toHaveText(`${IMAGE_TITLE}: imagen sacada`);
    expect((await page.request.get(src ?? "")).status()).toBe(404);
  } finally {
    await deleteLinksTitled(AVATAR_ID, [IMAGE_TITLE]);
  }
});
