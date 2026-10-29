import { randomBytes } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { connectMcpClient, grantOf, signIn } from "./support/session";

// Conexiones de IA en el panel (tarea 32, SPEC-mcp-server historia 4): la app
// conectada aparece con su permiso; se le cambia el permiso y, al
// desconectarla, su próxima llamada a /mcp da 401.
test.use({
  extraHTTPHeaders: { "cf-connecting-ip": `2001:db8:0d::${randomBytes(2).toString("hex")}` },
});

test("ver, cambiar el permiso y desconectar una app", async ({
  page,
  context,
  baseURL,
  request,
}) => {
  const { clientId, accessToken } = await connectMcpClient("avatar@plektia.test", false);
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await page.goto("/admin/conexiones");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conexiones");
  await expect(page.locator("code")).toHaveText(`${baseURL ?? ""}/mcp`);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);

  const row = page.locator(".connections-row").filter({ hasText: "E2E MCP" }).first();
  await expect(row).toContainText("Solo lectura");
  await row.getByRole("button", { name: /Permitir edición/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Permiso actualizado" })).toBeVisible();
  expect(await grantOf(clientId)).toMatchObject({ can_write: true });

  const call = () =>
    request.post("/mcp", {
      data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json, text/event-stream",
      },
    });
  expect((await call()).status()).toBe(200);

  // Las conexiones se ordenan de la más nueva: esta es la primera con ese nombre.
  const sameRow = page.locator(".connections-row").filter({ hasText: "E2E MCP" }).first();
  await sameRow.locator("summary").click();
  await sameRow.getByRole("button", { name: /Sí, desconectar/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "App desconectada" })).toBeVisible();
  expect((await grantOf(clientId))?.revoked_at).not.toBeNull();
  expect((await call()).status()).toBe(401);
});

test("sin sesión, /admin/conexiones manda al login", async ({ request }) => {
  const response = await request.get("/admin/conexiones", { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers()["location"]).toContain("/login?next=%2Fadmin%2Fconexiones");
});
