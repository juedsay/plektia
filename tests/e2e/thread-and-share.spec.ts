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

test.describe("ventana de compartir", () => {
  test("se abre con la vista previa y todos los destinos, sin pedir nada a terceros", async ({
    page,
    baseURL,
  }) => {
    const origins = new Set<string>();
    page.on("request", (r) => origins.add(new URL(r.url()).origin));
    await page.goto("/juedsay");
    await page.getByRole("button", { name: "Compartir esta página" }).click();

    const dialog = page.getByRole("dialog", { name: "Compartir" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Julián (dev)")).toBeVisible();
    await expect(dialog.getByText(/\/juedsay$/)).toBeVisible();

    const url = encodeURIComponent(new URL("/juedsay", baseURL).href);
    await expect(dialog.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/\?text=/,
    );
    await expect(dialog.getByRole("link", { name: "Facebook" })).toHaveAttribute(
      "href",
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    );
    for (const name of ["X", "LinkedIn", "Telegram", "Email"]) {
      await expect(dialog.getByRole("link", { name })).toBeVisible();
    }
    await expect(dialog.getByRole("link", { name: "Conocé Plektia" })).toHaveAttribute(
      "href",
      "/plektia",
    );
    // Los destinos son links: abrir la ventana no le pide nada a ningún tercero.
    expect([...origins]).toEqual([new URL(baseURL ?? "").origin]);
  });

  test("se cierra con Esc, con el botón y tocando afuera, y el foco vuelve al botón", async ({
    page,
  }) => {
    await page.goto("/juedsay");
    const trigger = page.getByRole("button", { name: "Compartir esta página" });
    const dialog = page.getByRole("dialog", { name: "Compartir" });

    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await dialog.getByRole("button", { name: "Cerrar" }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.mouse.click(5, 5);
    await expect(dialog).toBeHidden();
  });

  test("copiar el link lo copia y lo avisa", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "permisos del portapapeles solo en Chromium");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/juedsay?utm_source=prueba");
    await page.getByRole("button", { name: "Compartir esta página" }).click();
    await page.getByRole("button", { name: "Copiar link" }).click();

    await expect(page.getByRole("dialog").getByRole("status")).toHaveText("Link copiado");
    // Se copia la URL canónica, sin los parámetros de la visita.
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/juedsay$/);
  });

  test('con hoja del sistema ofrece "Más opciones" y la usa', async ({ page }) => {
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
    await page.getByRole("button", { name: "Más opciones" }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { shared?: ShareData }).shared?.url))
      .toMatch(/\/juedsay$/);
    await expect(page.getByRole("dialog", { name: "Compartir" })).toBeHidden();
  });

  test("si la hoja del sistema falla, copia el link y lo avisa", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "permisos del portapapeles solo en Chromium");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "share", {
        value: () => Promise.reject(new DOMException("bloqueado", "NotAllowedError")),
      });
    });
    await page.goto("/juedsay");
    await page.getByRole("button", { name: "Compartir esta página" }).click();
    await page.getByRole("button", { name: "Más opciones" }).click();
    await expect(page.getByRole("dialog").getByRole("status")).toHaveText("Link copiado");
  });

  test('sin hoja del sistema no muestra "Más opciones"', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "share", { value: undefined });
    });
    await page.goto("/juedsay");
    await page.getByRole("button", { name: "Compartir esta página" }).click();
    await expect(page.getByRole("button", { name: "Más opciones" })).toBeHidden();
  });

  test("en /plektia la tarjeta muestra la marca", async ({ page }) => {
    await page.goto("/plektia");
    await page.getByRole("button", { name: "Compartir esta página" }).click();
    const dialog = page.getByRole("dialog", { name: "Compartir" });
    await expect(dialog.getByText("Plektia", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/\/plektia$/)).toBeVisible();
  });
});
