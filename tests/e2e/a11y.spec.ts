import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// Accesibilidad (SPEC-public-page: WCAG 2.2 AAA). axe revisa cada página y los
// estados que no se ven al cargar (ventana de compartir, errores y avisos).
// El widget de Turnstile es un iframe de Cloudflare: queda afuera.
const TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag2aaa",
  "wcag21a",
  "wcag21aa",
  "wcag21aaa",
  "wcag22aa",
  "best-practice",
];

async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).exclude(".cf-turnstile").analyze();
  // Solo lo necesario para entender el error en el reporte.
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target.join(" ")),
  }));
}

const PAGES = ["/", "/plektia", "/juedsay", "/contact", "/login", "/legal/privacy", "/no-existe"];

test.describe("accesibilidad (axe, WCAG 2.2 AAA)", () => {
  for (const path of PAGES) {
    test(`${path} no tiene violaciones`, async ({ page }) => {
      await page.goto(path);
      expect(await violations(page)).toEqual([]);
    });
  }

  test("con la ventana de compartir abierta", async ({ page }) => {
    await page.goto("/juedsay");
    await page.getByRole("button", { name: "Compartir esta página" }).click();
    await expect(page.getByRole("dialog", { name: "Compartir" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test("el formulario de contacto con errores", async ({ page }) => {
    await page.goto("/contact");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test("el aviso de envío exitoso", async ({ page }) => {
    await page.goto("/contact?enviado");
    expect(await violations(page)).toEqual([]);
  });

  test("el login con el aviso de cuenta sin acceso", async ({ page }) => {
    await page.goto("/login?error=1");
    expect(await violations(page)).toEqual([]);
  });
});
