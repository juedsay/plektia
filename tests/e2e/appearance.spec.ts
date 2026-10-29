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

// Acento curado (tarea 36a): cada modo toma su tono (la página de prueba no tiene
// links, así que se mide el token que leen el hilo y los jacks).
async function chooseAccent(page: Page, name: string) {
  await page.goto("/admin/page");
  await page.getByRole("radio", { name, exact: true }).check();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/admin\/page\?guardado$/);
}

const accentColor = (page: Page) =>
  page.evaluate(() =>
    getComputedStyle(document.body).getPropertyValue("--color-accent").trim().toLowerCase(),
  );

test("el acento elegido se ve en la página pública, en claro y en oscuro", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await chooseMode(page, "Automático");
  await chooseAccent(page, "Turquesa");
  try {
    for (const [scheme, expected] of [
      ["dark", "#6fd8d2"],
      ["light", "#09504c"],
    ] as const) {
      const { visitor, close } = await visit(browser, baseURL ?? "", scheme);
      await expect(visitor.locator("body")).toHaveAttribute("data-accent", "turquesa");
      expect(await accentColor(visitor)).toBe(expected);
      const results = await new AxeBuilder({ page: visitor })
        .withTags(["wcag2a", "wcag2aa", "wcag2aaa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
      await close();
    }
  } finally {
    await chooseAccent(page, "Hueso");
  }
});

// Forma de los links (tarea 36b): la elección del panel llega a la página pública.
test("la forma de los links elegida se aplica en la página pública", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await page.goto("/admin/page");
  await page.getByRole("radio", { name: /^Pastillas/ }).check();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/admin\/page\?guardado$/);
  try {
    const { visitor, close } = await visit(browser, baseURL ?? "", "light");
    await expect(visitor.locator("[data-patchbay]")).toHaveAttribute("data-shape", "pills");
    await close();
  } finally {
    await page.goto("/admin/page");
    await page.getByRole("radio", { name: /^Filas/ }).check();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\/admin\/page\?guardado$/);
  }
});

// Tipografía de los nombres (tarea 36c): se usa y se precarga solo la elegida.
test("la tipografía elegida nombra la página y es la única que se precarga", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await page.goto("/admin/page");
  await page.getByRole("radio", { name: /^Fraunces/ }).check();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/admin\/page\?guardado$/);
  try {
    const { visitor, close } = await visit(browser, baseURL ?? "", "dark");
    await expect(visitor.locator("body")).toHaveAttribute("data-name-font", "fraunces");
    const nameFont = await visitor
      .locator(".identity h1")
      .evaluate((heading) => getComputedStyle(heading).fontFamily);
    expect(nameFont).toContain("Fraunces");
    const preloads = visitor.locator('link[rel="preload"][as="font"]');
    await expect(preloads).toHaveCount(1);
    await expect(preloads).toHaveAttribute("href", /^\/_astro\/fonts\/[\w-]+\.woff2$/);
    await close();
  } finally {
    await page.goto("/admin/page");
    await page.getByRole("radio", { name: /^Bricolage/ }).check();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\/admin\/page\?guardado$/);
  }
});
