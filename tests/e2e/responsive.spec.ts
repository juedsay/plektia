import { expect, test } from "@playwright/test";

// Todas las páginas públicas se adaptan a la pantalla: sin scroll horizontal
// desde un teléfono chico hasta un escritorio ancho.
const PAGES = ["/", "/plektia", "/juedsay", "/contact", "/login", "/legal/privacy", "/no-existe"];
const WIDTHS = [360, 390, 768, 1440];

for (const width of WIDTHS) {
  test(`a ${String(width)} px ninguna página se desborda`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of PAGES) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} a ${String(width)} px`).toBeLessThanOrEqual(0);
    }
  });
}

test("en un teléfono, los botones del login ocupan el ancho y se tocan fácil", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/login");
  for (const name of ["Entrar con GitHub", "Entrar con Google"]) {
    const box = await page.getByRole("link", { name }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThan(300);
  }
});

// Tarea 18c: las páginas del sitio usan el ancho del escritorio; las de links
// siguen siendo de celular en cualquier pantalla.
test.describe("en escritorio (1440 px)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const path of ["/juedsay", "/plektia"]) {
    test(`${path} sigue siendo una columna de celular`, async ({ page }) => {
      await page.goto(path);
      const box = await page.locator(".page").boundingBox();
      expect(box?.width).toBeLessThanOrEqual(480);
      await expect(page.getByRole("navigation", { name: "Sitio" })).toHaveCount(0);
    });
  }

  for (const [path, intro, action] of [
    ["/", "#hero-title", ".patchbay"],
    ["/contact", "#contact-title", "form.contact-form"],
    ["/login", "#login-title", ".login"],
  ] as const) {
    test(`${path} pone la presentación y la acción lado a lado`, async ({ page }) => {
      await page.goto(path);
      const introBox = await page.locator(intro).boundingBox();
      const actionBox = await page.locator(action).boundingBox();
      if (!introBox || !actionBox) throw new Error("falta la presentación o la acción");
      expect(actionBox.x).toBeGreaterThan(introBox.x + introBox.width);
      await expect(page.getByRole("navigation", { name: "Sitio" })).toBeVisible();
    });
  }

  test("la política tiene el índice al costado y sus enlaces llevan a cada sección", async ({
    page,
  }) => {
    await page.goto("/legal/privacy");
    const index = page.getByRole("navigation", { name: "En esta página" });
    await expect(index).toBeVisible();
    await index.getByRole("link", { name: "Tus derechos" }).click();
    await expect(page).toHaveURL(/#tus-derechos$/);
    await expect(page.getByRole("heading", { name: "Tus derechos" })).toBeInViewport();
  });

  test("la navegación del sitio marca la página actual", async ({ page }) => {
    await page.goto("/contact");
    await expect(
      page.getByRole("navigation", { name: "Sitio" }).getByRole("link", { name: "Contacto" }),
    ).toHaveAttribute("aria-current", "page");
  });
});

test("en el celular, la navegación de texto y el índice legal no aparecen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/legal/privacy");
  await expect(page.getByRole("navigation", { name: "Sitio" })).toBeHidden();
  await expect(page.getByRole("navigation", { name: "En esta página" })).toBeHidden();
});
