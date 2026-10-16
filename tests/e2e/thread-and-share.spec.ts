import { expect, type Page, test } from "@playwright/test";

// Hilo de la patchera y compartir, en el build real (seed: perfil `juedsay`).

/** Fija la semilla del hilo antes de que cargue la página. */
async function withSeed(page: Page, seed: number) {
  await page.addInitScript((value) => {
    window.__plektiaThreadSeed = value;
  }, seed);
}

async function threadReady(page: Page) {
  await expect(page.locator("[data-patchbay]")).toHaveAttribute("data-thread-ready", "");
}

test.describe("hilo", () => {
  for (const width of [390, 1440]) {
    test(`a ${String(width)} px nunca entra en la columna del texto`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await withSeed(page, 20261016);
      await page.goto("/juedsay");
      await threadReady(page);

      const { right, textLeft } = await page.evaluate(() => {
        const paths = [...document.querySelectorAll<SVGPathElement>(".thread path")];
        const right = Math.max(...paths.map((p) => p.getBoundingClientRect().right));
        const body = document.querySelector(".port-body");
        return { right, textLeft: body?.getBoundingClientRect().left ?? 0 };
      });
      expect(right).toBeGreaterThan(0);
      expect(right).toBeLessThanOrEqual(textLeft);
    });
  }

  test("la misma semilla dibuja el mismo hilo en cada carga", async ({ page }) => {
    await withSeed(page, 7);
    const shape = async () => {
      await page.goto("/juedsay");
      await threadReady(page);
      return page.locator('[data-thread="base"]').getAttribute("d");
    };
    const first = await shape();
    expect(first).toMatch(/^M/);
    expect(await shape()).toBe(first);
  });

  test("con movimiento reducido aparece entero, sin animación", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/juedsay");
    await threadReady(page);
    await expect(page.locator('[data-thread="base"]')).toHaveAttribute("d", /^M/);
  });
});

test.describe("compartir", () => {
  test("sin hoja nativa copia el link y lo avisa", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "permisos del portapapeles solo en Chromium");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "share", { value: undefined });
    });
    await page.goto("/juedsay");

    await page.getByRole("button", { name: "Compartir esta página" }).click();
    await expect(page.getByRole("status")).toHaveText("Link copiado");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  });

  test("con hoja nativa la usa y no muestra aviso", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "share", {
        value: (data: ShareData) => {
          (window as unknown as { shared: ShareData }).shared = data;
          return Promise.resolve();
        },
      });
    });
    await page.goto("/juedsay");
    await page.getByRole("button", { name: "Compartir esta página" }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { shared?: ShareData }).shared?.url))
      .toBe(page.url());
    await expect(page.getByRole("status")).toHaveText("");
  });
});
