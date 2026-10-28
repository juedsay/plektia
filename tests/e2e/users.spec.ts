import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { signIn } from "./support/session";

// Usuarios habilitados (tarea 23, SPEC-admin-panel): solo un owner activo ve e
// invoca /admin/usuarios. Las invitaciones de prueba se borran al terminar; no
// se da de baja ninguna cuenta del seed (otros archivos las usan en paralelo).
const AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const INVITED = { email: "e2e-invitada@plektia.test", handle: "e2e-invitada" };

test.describe.configure({ mode: "serial" });

async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(AA_TAGS).analyze();
  return results.violations.map((violation) => violation.id);
}

test.describe("usuarios: owner", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL ?? "", "owner@plektia.test");
  });

  test.afterAll(async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL: baseURL ?? "" });
    await signIn(context, baseURL ?? "", "owner@plektia.test");
    await context.request.post("/_actions/users.revoke", {
      multipart: { email: INVITED.email },
      headers: { origin: baseURL ?? "" },
    });
    await context.close();
  });

  test("ve la pantalla desde la navegación, con las cuentas y sin poder quitarse a sí mismo", async ({
    page,
  }) => {
    await page.goto("/admin");
    await page
      .getByRole("navigation", { name: "Panel" })
      .getByRole("link", { name: "Usuarios" })
      .click();
    await expect(page).toHaveURL(/\/admin\/usuarios$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Usuarios");
    const response = await page.request.get("/admin/usuarios");
    expect(response.headers()["cache-control"]).toBe("private, no-store");

    const member = page.locator(".users-row", { hasText: "member@plektia.test" });
    await expect(member).toContainText("Activa");
    const self = page.locator(".users-row", { hasText: "owner@plektia.test" });
    await expect(self.getByText("Quitar acceso")).toHaveCount(0);
    expect(await violations(page)).toEqual([]);
  });

  test("un handle reservado o tomado se rechaza junto al campo, sin perder lo escrito", async ({
    page,
  }) => {
    await page.goto("/admin/usuarios");
    await page.getByLabel("Correo").fill(INVITED.email);
    await page.getByLabel("Dirección de su página").fill("admin");
    await page.getByRole("button", { name: "Invitar" }).click();
    await expect(page.getByText("Ese nombre de usuario está reservado.")).toBeVisible();
    await expect(page.getByLabel("Correo")).toHaveValue(INVITED.email);

    await page.getByLabel("Dirección de su página").fill("miembro-demo");
    await page.getByRole("button", { name: "Invitar" }).click();
    await expect(page.getByText(/ya lo usa otra página/)).toBeVisible();
  });

  test("invita y quita el acceso a una invitación", async ({ page }) => {
    await page.goto("/admin/usuarios");
    await page.getByLabel("Correo").fill(INVITED.email);
    await page.getByLabel("Dirección de su página").fill(INVITED.handle);
    await page.getByRole("button", { name: "Invitar" }).click();
    await expect(page).toHaveURL(/\/admin\/usuarios\?invitado$/);
    const row = page.locator(".users-row", { hasText: INVITED.email });
    await expect(row).toContainText("Invitación pendiente");
    await expect(row).toContainText(`/${INVITED.handle}`);

    await row.locator("summary").click();
    await row.getByRole("button", { name: `Sí, quitar acceso a ${INVITED.email}` }).click();
    await expect(page).toHaveURL(/\/admin\/usuarios\?acceso-quitado$/);
    await expect(page.locator(".users-row", { hasText: INVITED.email })).toHaveCount(0);
  });
});

test.describe("usuarios: member", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL ?? "", "member@plektia.test");
  });

  test("no ve la navegación y la pantalla no existe (404)", async ({ page }) => {
    await page.goto("/admin");
    await expect(
      page.getByRole("navigation", { name: "Panel" }).getByRole("link", { name: "Usuarios" }),
    ).toHaveCount(0);
    const response = await page.goto("/admin/usuarios");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("member@plektia.test")).toHaveCount(0);
  });

  test("tampoco puede llamar a las Actions de owner", async ({ context, baseURL }) => {
    for (const [action, multipart] of [
      ["users.invite", { email: "colada@plektia.test", handle: "colada" }],
      ["users.revoke", { email: "owner@plektia.test" }],
    ] as const) {
      const response = await context.request.post(`/_actions/${action}`, {
        multipart,
        headers: { origin: baseURL ?? "" },
      });
      expect(await response.text()).toContain("No tenés permiso para hacer eso.");
    }
  });
});

test("sin sesión, /admin/usuarios manda al login", async ({ request }) => {
  const response = await request.get("/admin/usuarios", { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers()["location"]).toContain("/login?next=%2Fadmin%2Fusuarios");
});
