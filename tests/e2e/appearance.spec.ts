import { randomBytes } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";

import { signIn } from "./support/session";

// Modo claro, oscuro y automático de la página (tarea 34, SPEC-appearance).
// Cuenta del avatar (/avatar-demo): ninguna otra prueba depende de su modo.
test.use({
  extraHTTPHeaders: { "cf-connecting-ip": `2001:db8:0e::${randomBytes(2).toString("hex")}` },
});

const PAPER = "rgb(245, 244, 239)";
const BLACK = "rgb(18, 19, 21)";

const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/**
 * Un visitante nuevo, con el modo de su dispositivo: la página pública se
 * cachea un minuto en el navegador, así que cada visita va en su propio contexto.
 */
async function visit(browser: Browser, baseURL: string, colorScheme: "light" | "dark") {
  const context = await browser.newContext({ baseURL, colorScheme });
  const visitor = await context.newPage();
  await visitor.goto("/avatar-demo");
  return { visitor, close: () => context.close() };
}

async function chooseMode(page: Page, name: "Automático" | "Oscuro" | "Claro") {
  await page.goto("/admin/page");
  await page.getByRole("radio", { name: new RegExp(`^${name}`) }).check();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/admin\/page\?guardado$/);
}

test.describe.configure({ mode: "serial" });

test("el modo elegido en el panel se ve en la página pública", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await chooseMode(page, "Claro");
  const inLight = await visit(browser, baseURL ?? "", "dark");
  await expect(inLight.visitor.locator("body")).toHaveAttribute("data-mode", "light");
  expect(await background(inLight.visitor)).toBe(PAPER);
  await expect(inLight.visitor.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#f5f4ef",
  );
  // Claro también cumple: axe con las reglas de contraste mejorado (AAA).
  const results = await new AxeBuilder({ page: inLight.visitor })
    .withTags(["wcag2a", "wcag2aa", "wcag2aaa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
  await inLight.close();

  await chooseMode(page, "Oscuro");
  const inDark = await visit(browser, baseURL ?? "", "light");
  expect(await background(inDark.visitor)).toBe(BLACK);
  await inDark.close();
});

test("en automático, decide el dispositivo de quien visita", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await chooseMode(page, "Automático");

  for (const [scheme, expected] of [
    ["light", PAPER],
    ["dark", BLACK],
  ] as const) {
    const { visitor, close } = await visit(browser, baseURL ?? "", scheme);
    await expect(visitor.locator("body")).toHaveAttribute("data-mode", "auto");
    expect(await background(visitor)).toBe(expected);
    await expect(visitor.locator('meta[name="theme-color"]')).toHaveCount(2);
    await close();
  }
});
