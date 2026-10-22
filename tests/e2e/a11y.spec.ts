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

  // axe no puede juzgar cómo se ve el foco (WCAG 2.4.13, AAA). Se recorre cada
  // página con Tab y se mide el contorno de cada elemento enfocado: sólido, de
  // al menos 2 px y con contraste ≥ 3:1 contra el fondo de la página.
  for (const path of ["/", "/juedsay", "/contact", "/login", "/legal/privacy"]) {
    test(`${path}: el foco se ve en cada elemento (2.4.13)`, async ({ page }) => {
      await page.goto(path);
      const problems: string[] = [];
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press("Tab");
        const focus = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const style = getComputedStyle(el);
          const bg = getComputedStyle(document.body).backgroundColor;
          const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
          const lum = (rgb: number[]) => {
            const [r = 0, g = 0, b = 0] = rgb.map((v) => {
              const x = v / 255;
              return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const [a, b] = [lum(parse(style.outlineColor)), lum(parse(bg))];
          return {
            name: `${el.tagName.toLowerCase()} ${el.getAttribute("aria-label") ?? el.textContent.trim().slice(0, 30)}`,
            outline: style.outlineStyle,
            width: Number.parseFloat(style.outlineWidth),
            contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          };
        });
        if (!focus) continue;
        if (focus.outline === "none" || focus.width < 2 || focus.contrast < 3) {
          problems.push(
            `${focus.name}: ${focus.outline} ${String(focus.width)}px ${focus.contrast.toFixed(1)}:1`,
          );
        }
      }
      expect(problems).toEqual([]);
    });
  }
});
