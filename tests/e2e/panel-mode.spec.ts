import { randomBytes } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { signIn } from "./support/session";

// Modo del panel (tarea 35, SPEC-appearance): sigue al sistema hasta que la
// cuenta elige; la elección vale en cualquier dispositivo (se guarda en la base).
test.use({
  extraHTTPHeaders: { "cf-connecting-ip": `2001:db8:0f::${randomBytes(2).toString("hex")}` },
});
test.describe.configure({ mode: "serial" });

const PAPER = "rgb(245, 244, 239)";
const BLACK = "rgb(18, 19, 21)";
const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

async function choose(page: Page, name: "Automático" | "Oscuro" | "Claro") {
  await page.locator(".admin-appearance summary").click();
  await page.getByRole("button", { name, exact: true }).click();
}

test("el panel sigue al sistema y la elección queda guardada", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  // Desde un estado conocido, aunque una corrida anterior haya quedado a medias.
  await page.request.post("/admin/apariencia", {
    form: { panelMode: "auto", next: "/admin" },
    headers: { Origin: baseURL ?? "" },
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/admin/estadisticas?dias=30");
  await expect(page.locator("body")).toHaveAttribute("data-mode", "auto");
  expect(await background(page)).toBe(PAPER);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);

  // Fijar Oscuro: vuelve a la misma pantalla y gana sobre el sistema.
  await choose(page, "Oscuro");
  await expect(page).toHaveURL(/\/admin\/estadisticas\?dias=30$/);
  await expect(page.locator("body")).toHaveAttribute("data-mode", "dark");
  expect(await background(page)).toBe(BLACK);
  await page.locator(".admin-appearance summary").click();
  await expect(page.getByRole("button", { name: "Oscuro", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // En otro dispositivo (otro navegador, otro sistema), la misma elección.
  const other = await context
    .browser()
    ?.newContext({ baseURL: baseURL ?? "", colorScheme: "light" });
  if (!other) throw new Error("sin navegador");
  await signIn(other, baseURL ?? "", "avatar@plektia.test");
  const otherPage = await other.newPage();
  await otherPage.goto("/admin");
  await expect(otherPage.locator("body")).toHaveAttribute("data-mode", "dark");
  await other.close();

  await page.getByRole("button", { name: "Automático", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-mode", "auto");
});

test("el formulario solo vuelve a pantallas del panel", async ({ page, context, baseURL }) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await page.goto("/admin");
  const response = await page.request.post("/admin/apariencia", {
    form: { panelMode: "auto", next: "https://otro-sitio.example/robar" },
    headers: { Origin: baseURL ?? "" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers()["location"]).toBe("/admin");
});
