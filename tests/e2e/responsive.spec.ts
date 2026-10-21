import { expect, test } from "@playwright/test";

// Todas las páginas públicas se adaptan a la pantalla: sin scroll horizontal
// desde un teléfono chico hasta un escritorio ancho.
const PAGES = ["/", "/plektia", "/juedsay", "/contacto", "/login", "/no-existe"];
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
