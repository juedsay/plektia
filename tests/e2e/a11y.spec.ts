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
  return results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
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
          const focused = document.activeElement;
          if (!focused || focused === document.body) return null;
          const style = getComputedStyle(focused);
          const backgroundColor = getComputedStyle(document.body).backgroundColor;
          // "rgb(242, 242, 238)" → [242, 242, 238]
          const parseRgb = (color: string) =>
            (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
          // Luminancia relativa de WCAG: base de la fórmula de contraste.
          const relativeLuminance = (rgb: number[]) => {
            const [red = 0, green = 0, blue = 0] = rgb.map((channel) => {
              const normalized = channel / 255;
              return normalized <= 0.03928
                ? normalized / 12.92
                : ((normalized + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
          };
          const outlineLuminance = relativeLuminance(parseRgb(style.outlineColor));
          const backgroundLuminance = relativeLuminance(parseRgb(backgroundColor));
          const lighter = Math.max(outlineLuminance, backgroundLuminance);
          const darker = Math.min(outlineLuminance, backgroundLuminance);
          return {
            name: `${focused.tagName.toLowerCase()} ${focused.getAttribute("aria-label") ?? focused.textContent.trim().slice(0, 30)}`,
            outline: style.outlineStyle,
            width: Number.parseFloat(style.outlineWidth),
            contrast: (lighter + 0.05) / (darker + 0.05),
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
