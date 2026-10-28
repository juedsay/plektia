import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { deleteLinksTitled, signIn } from "./support/session";

// Configuración de medios por link (tarea 24, SPEC-live-status): "Transmito en
// este canal" y el contenido destacado, en el editor. Usa la cuenta del avatar
// (seed): ningún otro archivo toca los links de su página.
const EMAIL = "avatar@plektia.test";
const PAGE_ID = "44444444-4444-4444-8444-444444444444";
const TITLES = ["Mi canal de YouTube", "Mi blog"];

test.describe.configure({ mode: "serial" });

async function violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .exclude("[data-preview-frame]")
    .analyze();
  return results.violations.map((violation) => violation.id);
}

async function addLink(page: Page, url: string, title: string) {
  const add = page.locator("form.add-link");
  await add.getByLabel("URL").fill(url);
  await add.getByLabel("Título").fill(title);
  await add.getByRole("button", { name: "Agregar link" }).click();
  await expect(page.getByRole("button", { name: `Editar ${title}` })).toBeVisible();
}

test.describe("medios por link", () => {
  test.beforeAll(async () => {
    await deleteLinksTitled(PAGE_ID, TITLES);
  });

  test.afterAll(async () => {
    await deleteLinksTitled(PAGE_ID, TITLES);
  });

  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL ?? "", EMAIL);
  });

  test("un canal de YouTube se vigila y elige qué destacar; se guarda solo", async ({ page }) => {
    await page.goto("/admin");
    await addLink(page, "https://www.youtube.com/@canal-e2e", "Mi canal de YouTube");

    await page.getByRole("button", { name: "Editar Mi canal de YouTube" }).click();
    const panel = page.locator(".editor-link-panel:not([hidden])");
    const watch = panel.getByLabel(/Transmito en este canal/);
    await expect(watch).not.toBeChecked();
    await expect(panel.getByRole("radio", { name: /Último video/ })).toBeChecked();
    expect(await violations(page)).toEqual([]);

    await watch.check();
    await expect(page.locator("[data-editor-status]")).toHaveText("Mi canal de YouTube: guardado");
    await panel.getByRole("radio", { name: /Último Short/ }).check();
    await expect(page.locator("[data-editor-status]")).toHaveText("Mi canal de YouTube: guardado");

    // "Fijado" con un link que no es un video: el error queda junto al campo.
    await panel.getByRole("radio", { name: /Fijado/ }).check();
    const pinned = panel.getByLabel("Video para fijar");
    await pinned.fill("https://www.youtube.com/@otro-canal");
    await pinned.press("Tab");
    await expect(pinned).toHaveAttribute("aria-invalid", "true");
    await pinned.fill("https://www.youtube.com/shorts/dQw4w9WgXcQ");
    await pinned.press("Tab");
    await expect(pinned).not.toHaveAttribute("aria-invalid");

    // Al recargar, el editor muestra lo guardado.
    await page.reload();
    await page.getByRole("button", { name: "Editar Mi canal de YouTube" }).click();
    const reloaded = page.locator(".editor-link-panel:not([hidden])");
    await expect(reloaded.getByLabel(/Transmito en este canal/)).toBeChecked();
    await expect(reloaded.getByRole("radio", { name: /Fijado/ })).toBeChecked();
    await expect(reloaded.getByLabel("Video para fijar")).toHaveValue(
      "https://youtu.be/dQw4w9WgXcQ",
    );
  });

  test("un link que no es un canal no muestra las opciones", async ({ page }) => {
    await page.goto("/admin");
    await addLink(page, "https://plektia.app/blog-e2e", "Mi blog");
    await page.getByRole("button", { name: "Editar Mi blog" }).click();
    const panel = page.locator(".editor-link-panel:not([hidden])");
    await expect(panel.getByLabel("Título")).toBeVisible();
    await expect(panel.getByLabel(/Transmito en este canal/)).toHaveCount(0);
    await expect(panel.getByRole("group", { name: "Contenido destacado" })).toHaveCount(0);
  });

  test("la Action rechaza vigilar un link que no es un canal", async ({ page, baseURL }) => {
    await page.goto("/admin");
    const blogId = await page
      .locator(".editor-link", { hasText: "Mi blog" })
      .getAttribute("data-link-id");
    const response = await page.request.post("/_actions/links.setMedia", {
      data: { pageId: PAGE_ID, linkId: blogId, watchLive: true, featuredMode: "latest_video" },
      headers: { origin: baseURL ?? "" },
    });
    expect(await response.text()).toContain("Solo se vigila un canal de YouTube, Twitch o Kick.");
  });
});
