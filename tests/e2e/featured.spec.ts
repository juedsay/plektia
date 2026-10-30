import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Contenido destacado de YouTube en la página pública (tarea 25c,
// SPEC-live-status). El seed le da al YouTube de /juedsay un "último video".

test.describe("contenido destacado", () => {
  test("la sub-fila muestra qué es y se despliega con el video", async ({ page }) => {
    await page.goto("/juedsay");
    const toggle = page.getByRole("button", {
      name: /Último video: Cómo testeo RLS con pgTAP · .+/,
    });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const video = page.getByRole("link", {
      name: "Ver en YouTube: Cómo testeo RLS con pgTAP, 12 minutos 34 segundos",
    });
    // Cerrado, el panel mide 0 y queda fuera del foco (`inert`).
    const panel = page.locator(".latest-panel").first();
    await expect(panel).toHaveAttribute("inert", "");
    expect(await panel.evaluate((element) => element.getBoundingClientRect().height)).toBe(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute("href", "https://www.youtube.com/watch?v=aBcDeFgHiJk");
    await expect(video.locator("img")).toHaveAttribute("src", "/thumbs/aBcDeFgHiJk.jpg");
    await expect(video.locator("img")).not.toHaveAttribute("data-src", /.*/);
    await expect(video.getByText("12:34")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);

    await toggle.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("cerrado no pide la miniatura; al abrirlo, sale del propio sitio", async ({
    page,
    baseURL,
  }) => {
    const requested: URL[] = [];
    page.on("request", (request) => requested.push(new URL(request.url())));
    await page.goto("/juedsay");
    await page.waitForLoadState("networkidle");
    expect(requested.some((url) => url.pathname.startsWith("/thumbs/"))).toBe(false);

    await page.getByRole("button", { name: /Último video/ }).click();
    await expect
      .poll(() => requested.some((url) => url.pathname === "/thumbs/aBcDeFgHiJk.jpg"))
      .toBe(true);
    expect(new Set(requested.map((url) => url.origin))).toEqual(
      new Set([new URL(baseURL ?? "").origin]),
    );
  });

  test("/thumbs solo acepta IDs de video", async ({ request }) => {
    for (const path of ["/thumbs/no-es-un-id.jpg", "/thumbs/aBcDeFgHiJk.png", "/thumbs/x"]) {
      expect((await request.get(path)).status()).toBe(404);
    }
  });
});
