import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { resetPagesOf, signIn } from "./support/session";

// Panel (SPEC-admin-panel, tarea 18a): marco, selector de página, alta de
// páginas e inicio. Con sesión real del seed; WCAG 2.2 AA.
const AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
// El miembro del seed arranca con una sola página: las altas se prueban con él.
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(AA_TAGS).analyze();
  return results.violations.map((violation) => ({
    id: violation.id,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
  }));
}

test.describe("panel: inicio", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL ?? "", "owner@plektia.test");
  });

  test("muestra la página actual, su dirección pública y sus secciones", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.headers()["cache-control"]).toBe("private, no-store");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Julián (dev)");
    await expect(page.getByRole("link", { name: /\/juedsay/ })).toHaveAttribute(
      "href",
      /\/juedsay$/,
    );
    await expect(page.locator(".admin-group-title")).toHaveText([
      "Redes",
      "Proyectos",
      "Artículos",
    ]);
    await expect(
      page.getByRole("navigation", { name: "Panel" }).getByRole("link", { name: "Inicio" }),
    ).toHaveAttribute("aria-current", "page");
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    test(`a ${String(viewport.width)} px no tiene violaciones de axe, con el selector abierto`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/admin");
      expect(await violations(page)).toEqual([]);
      await page.locator("summary", { hasText: "Cambiar de página" }).click();
      await expect(page.getByRole("link", { name: "Nueva página" })).toBeVisible();
      expect(await violations(page)).toEqual([]);
      // Esc lo cierra y el foco vuelve al selector.
      await page.keyboard.press("Escape");
      await expect(page.getByRole("link", { name: "Nueva página" })).toBeHidden();
    });
  }
});

test.describe("panel: páginas de una cuenta", () => {
  // Cambian datos del miembro: van en orden y dejan todo como estaba.
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await resetPagesOf(MEMBER_ID);
  });

  test.afterAll(async () => {
    await resetPagesOf(MEMBER_ID);
  });

  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL ?? "", "member@plektia.test");
  });

  test("un handle reservado se rechaza junto al campo, sin perder lo escrito", async ({ page }) => {
    await page.goto("/admin/pages/new");
    await page.getByLabel("Dirección").fill("login");
    await page.getByLabel("Nombre").fill("Mi segunda");
    await page.getByRole("button", { name: "Crear página" }).click();

    await expect(page.getByRole("alert")).toBeFocused();
    await expect(page.getByText("Ese nombre de usuario está reservado.")).toBeVisible();
    await expect(page.getByLabel("Dirección")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Nombre")).toHaveValue("Mi segunda");
    expect(await violations(page)).toEqual([]);
  });

  test("crea una página, pasa a trabajar con ella y se ve en su /{handle}", async ({ page }) => {
    await page.goto("/admin/pages/new");
    await page.getByLabel("Dirección").fill("miembro-segunda");
    await page.getByLabel("Nombre").fill("Mi segunda");
    await page.getByRole("button", { name: "Crear página" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mi segunda");
    await expect(page.getByText("Esta página todavía no tiene links.")).toBeVisible();
    const publicPage = await page.request.get("/miembro-segunda");
    expect(publicPage.status()).toBe(200);
  });

  test("el selector cambia de página y la recuerda al volver", async ({ page }) => {
    await page.goto("/admin");
    await page.locator("summary", { hasText: "Cambiar de página" }).click();
    await page.getByRole("button", { name: /Miembro Demo/ }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Miembro Demo");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Miembro Demo");
  });

  test("con 3 páginas, el alta avisa el límite en lugar del formulario", async ({ page }) => {
    await page.goto("/admin/pages/new");
    await page.getByLabel("Dirección").fill("miembro-tercera");
    await page.getByLabel("Nombre").fill("Mi tercera");
    await page.getByRole("button", { name: "Crear página" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mi tercera");

    await page.goto("/admin/pages/new");
    await expect(page.getByRole("alert")).toContainText("Llegaste al máximo de 3 páginas.");
    await expect(page.getByLabel("Dirección")).toHaveCount(0);
    await page.locator("summary", { hasText: "Cambiar de página" }).click();
    await expect(page.getByRole("link", { name: "Nueva página" })).toHaveCount(0);
  });
});
