import { randomBytes } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";

import { deleteLinksTitled, insertLink, signIn } from "./support/session";

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

// Fila de íconos (tarea 36d): el dueño elige qué links van como ícono.
const AVATAR_ID = "44444444-4444-4444-8444-444444444444";
const ICON_TITLES = ["Instagram de prueba", "Sitio de prueba"];

test("un link elegido como ícono pasa a la fila bajo la bio y deja la lista", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await insertLink(AVATAR_ID, AVATAR_ID, {
    title: "Instagram de prueba",
    url: "https://www.instagram.com/plektia",
    provider: "instagram",
    provider_handle: null,
  });
  await insertLink(AVATAR_ID, AVATAR_ID, {
    title: "Sitio de prueba",
    url: "https://plektia.app/prueba",
    provider: "generic",
    provider_handle: null,
  });
  try {
    await signIn(context, baseURL ?? "", "avatar@plektia.test");
    await page.goto("/admin");
    await page.getByRole("button", { name: "Editar Instagram de prueba" }).click();
    // Radio controlado: queda marcado cuando el servidor confirma.
    await page.getByRole("radio", { name: /^Como ícono/ }).click();
    await expect(page.locator("[data-editor-status]")).toHaveText(
      "Instagram de prueba: como ícono",
    );

    const { visitor, close } = await visit(browser, baseURL ?? "", "light");
    const icons = visitor.getByRole("navigation", { name: "Redes" });
    await expect(icons.getByRole("link", { name: "Instagram de prueba" })).toHaveAttribute(
      "href",
      "https://www.instagram.com/plektia",
    );
    await expect(visitor.locator(".patchbay").getByText("Instagram de prueba")).toHaveCount(0);
    await expect(visitor.locator(".patchbay").getByText("Sitio de prueba")).toBeVisible();
    const box = await icons.getByRole("link").first().boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    const results = await new AxeBuilder({ page: visitor })
      .withTags(["wcag2a", "wcag2aa", "wcag2aaa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
    await close();
  } finally {
    await deleteLinksTitled(AVATAR_ID, ICON_TITLES);
  }
});

// Destacados (tarea 36e): con el acento en su lugar o arriba de todo.
const HIGHLIGHT_TITLES = ["Destacado arriba", "Destacado con acento"];

test("un destacado arriba va en tarjeta antes de las secciones; el de acento, en su lugar", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  for (const title of HIGHLIGHT_TITLES) {
    await insertLink(AVATAR_ID, AVATAR_ID, {
      title,
      url: `https://plektia.app/${title.replaceAll(" ", "-").toLowerCase()}`,
      provider: "generic",
      provider_handle: null,
    });
  }
  try {
    await signIn(context, baseURL ?? "", "avatar@plektia.test");
    await page.goto("/admin");
    for (const [title, option] of [
      ["Destacado arriba", /^Arriba de todo/],
      ["Destacado con acento", /^Con el acento/],
    ] as const) {
      await page.getByRole("button", { name: `Editar ${title}` }).click();
      const panel = page.locator(".editor-link-panel:not([hidden])");
      // Radio controlado: queda marcado cuando el servidor confirma.
      await panel.getByRole("radio", { name: option }).click();
      await expect(page.locator("[data-editor-status]")).toContainText(`${title}:`);
      await page.getByRole("button", { name: `Listo ${title}` }).click();
    }

    const { visitor, close } = await visit(browser, baseURL ?? "", "dark");
    const highlights = visitor.getByRole("region", { name: "Destacados" });
    await expect(highlights.getByRole("link", { name: /Destacado arriba/ })).toBeVisible();
    await expect(visitor.locator(".patchbay").getByText("Destacado arriba")).toHaveCount(0);
    await expect(
      visitor.locator(".port.is-highlighted").getByText("Destacado con acento"),
    ).toBeVisible();
    const results = await new AxeBuilder({ page: visitor })
      .withTags(["wcag2a", "wcag2aa", "wcag2aaa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
    await close();
  } finally {
    await deleteLinksTitled(AVATAR_ID, HIGHLIGHT_TITLES);
  }
});

// Estilo Punto (SPEC-styles): elegirlo en el panel lo aplica en la página
// pública, con su propia hoja de estilos, y cumple AAA en claro y en oscuro.
test("el estilo Punto se elige en el panel y se ve en la página, AAA en los dos modos", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await page.goto("/admin/page");
  await page.getByRole("radio", { name: /^Punto/ }).check();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/admin\/page\?guardado$/);
  try {
    for (const scheme of ["dark", "light"] as const) {
      const { visitor, close } = await visit(browser, baseURL ?? "", scheme);
      await expect(visitor.locator("body")).toHaveAttribute("data-theme", "punto");
      // Hueso no es un acento de Punto: usa el suyo (terracota). Bricolage sí lo admite.
      await expect(visitor.locator("body")).toHaveAttribute("data-accent", "coral");
      await expect(visitor.locator("body")).toHaveAttribute("data-name-font", "bricolage");
      await expect(visitor.locator("[data-patchbay]")).toHaveAttribute("data-shape", "cards");
      await expect(visitor.locator('link[rel="stylesheet"][href*="punto"]')).toHaveCount(1);
      await expect(visitor.locator("svg.thread")).toHaveCount(0);
      const results = await new AxeBuilder({ page: visitor })
        .withTags(["wcag2a", "wcag2aa", "wcag2aaa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
      await close();
    }
  } finally {
    await page.goto("/admin/page");
    await page.getByRole("radio", { name: /^Patchera/ }).check();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\/admin\/page\?guardado$/);
  }
});

// Estilo Subte (SPEC-styles): líneas y estaciones, AAA en los dos modos.
test("el estilo Subte se elige en el panel y se ve en la página, AAA en los dos modos", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await page.goto("/admin/page");
  await page.getByRole("radio", { name: /^Subte/ }).check();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/admin\/page\?guardado$/);
  try {
    for (const scheme of ["dark", "light"] as const) {
      const { visitor, close } = await visit(browser, baseURL ?? "", scheme);
      await expect(visitor.locator("body")).toHaveAttribute("data-theme", "subte");
      // Hueso no es una línea de Subte: usa la suya (coral). Las filas sí las admite.
      await expect(visitor.locator("body")).toHaveAttribute("data-accent", "coral");
      await expect(visitor.locator("[data-patchbay]")).toHaveAttribute("data-shape", "rows");
      await expect(visitor.locator('link[rel="stylesheet"][href*="subte"]')).toHaveCount(1);
      const results = await new AxeBuilder({ page: visitor })
        .withTags(["wcag2a", "wcag2aa", "wcag2aaa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
      await close();
    }
  } finally {
    await page.goto("/admin/page");
    await page.getByRole("radio", { name: /^Patchera/ }).check();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\/admin\/page\?guardado$/);
  }
});

// Estilo Lomo cosido (SPEC-styles): capítulos, lomo y cinta, AAA en los dos modos.
test("el estilo Lomo cosido se elige en el panel y se ve en la página, AAA en los dos modos", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await page.goto("/admin/page");
  await page.getByRole("radio", { name: /^Lomo cosido/ }).check();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/admin\/page\?guardado$/);
  try {
    for (const scheme of ["dark", "light"] as const) {
      const { visitor, close } = await visit(browser, baseURL ?? "", scheme);
      await expect(visitor.locator("body")).toHaveAttribute("data-theme", "lomo");
      // Hueso es una de sus telas: queda. Bricolage también la admite.
      await expect(visitor.locator("body")).toHaveAttribute("data-accent", "hueso");
      await expect(visitor.locator('link[rel="stylesheet"][href*="lomo"]')).toHaveCount(1);
      const results = await new AxeBuilder({ page: visitor })
        .withTags(["wcag2a", "wcag2aa", "wcag2aaa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
      await close();
    }
  } finally {
    await page.goto("/admin/page");
    await page.getByRole("radio", { name: /^Patchera/ }).check();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\/admin\/page\?guardado$/);
  }
});

// Estilo Lado A / B (SPEC-styles): lados escritos a mano, AAA en los dos modos.
test("el estilo Lado A / B se elige en el panel y se ve en la página, AAA en los dos modos", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await page.goto("/admin/page");
  await page.getByRole("radio", { name: /^Lado A \/ B/ }).check();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/admin\/page\?guardado$/);
  try {
    for (const scheme of ["dark", "light"] as const) {
      const { visitor, close } = await visit(browser, baseURL ?? "", scheme);
      await expect(visitor.locator("body")).toHaveAttribute("data-theme", "cassette");
      await expect(visitor.locator('link[rel="stylesheet"][href*="cassette"]')).toHaveCount(1);
      const results = await new AxeBuilder({ page: visitor })
        .withTags(["wcag2a", "wcag2aa", "wcag2aaa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
      await close();
    }
  } finally {
    await page.goto("/admin/page");
    await page.getByRole("radio", { name: /^Patchera/ }).check();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\/admin\/page\?guardado$/);
  }
});
