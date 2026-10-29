import { randomBytes } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { grantOf, OAUTH_REDIRECT_URI, signIn, startOAuthAuthorization } from "./support/session";

// Consentimiento de una app de IA (tarea 30, SPEC-mcp-server historia 1): el
// host destacado, el aviso de nombre no verificado, solo lectura por defecto,
// aprobar y rechazar. La "app" es un cliente registrado contra Supabase local;
// su vuelta (127.0.0.1:9) se intercepta.
test.use({
  extraHTTPHeaders: { "cf-connecting-ip": `2001:db8:0a::${randomBytes(2).toString("hex")}` },
});

/** Lo que la app recibe al volver: la URL con el código o el error. */
async function interceptReturn(page: Page) {
  let returned: URL | null = null;
  await page.route(`${OAUTH_REDIRECT_URI}**`, async (route) => {
    returned = new URL(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/plain", body: "app" });
  });
  return () => returned;
}

test("aprobar con el permiso por defecto: vuelve a la app con un código, en solo lectura", async ({
  page,
  context,
  baseURL,
}) => {
  const { clientId, authorizationId } = await startOAuthAuthorization("Claude");
  await signIn(context, baseURL ?? "", "member@plektia.test");
  const returned = await interceptReturn(page);

  await page.goto(`/oauth/consent?authorization_id=${authorizationId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conectar una app a tu Plektia");
  await expect(page.getByText("Plektia no lo verificó")).toBeVisible();
  await expect(page.locator(".consent-host-value")).toHaveText("127.0.0.1:9");
  await expect(page.getByRole("radio", { name: /Solo lectura/ })).toBeChecked();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);

  await page.getByRole("button", { name: "Autorizar" }).dblclick();
  await expect.poll(() => returned()?.searchParams.get("code") ?? null).not.toBeNull();
  expect(returned()?.searchParams.get("state")).toBe("estado-e2e");
  expect(await grantOf(clientId)).toMatchObject({
    client_name: "Claude",
    redirect_host: "127.0.0.1:9",
    can_write: false,
    revoked_at: null,
  });
});

test("elegir edición la guarda con permiso de escritura", async ({ page, context, baseURL }) => {
  const { clientId, authorizationId } = await startOAuthAuthorization("Editor");
  await signIn(context, baseURL ?? "", "member@plektia.test");
  const returned = await interceptReturn(page);

  await page.goto(`/oauth/consent?authorization_id=${authorizationId}`);
  await page.getByRole("radio", { name: /Lectura y edición/ }).check();
  await page.getByRole("button", { name: "Autorizar" }).click();
  await expect.poll(() => returned()?.searchParams.get("code") ?? null).not.toBeNull();
  expect(await grantOf(clientId)).toMatchObject({ can_write: true });
});

test("rechazar vuelve a la app con access_denied y no guarda la conexión", async ({
  page,
  context,
  baseURL,
}) => {
  const { clientId, authorizationId } = await startOAuthAuthorization("Rechazada");
  await signIn(context, baseURL ?? "", "member@plektia.test");
  const returned = await interceptReturn(page);

  await page.goto(`/oauth/consent?authorization_id=${authorizationId}`);
  await page.getByRole("button", { name: "Rechazar" }).click();
  await expect.poll(() => returned()?.searchParams.get("error") ?? null).toBe("access_denied");
  expect(await grantOf(clientId)).toBeNull();
});

test("un pedido inválido o ya usado lo dice", async ({ page, context, baseURL }) => {
  await signIn(context, baseURL ?? "", "member@plektia.test");
  await page.goto("/oauth/consent?authorization_id=no-existe-este-pedido");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Este pedido ya no es válido");
});

test("sin sesión, el consentimiento manda al login y vuelve al mismo pedido", async ({
  request,
}) => {
  const response = await request.get("/oauth/consent?authorization_id=abc12345", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  expect(response.headers()["location"]).toBe(
    `/login?next=${encodeURIComponent("/oauth/consent?authorization_id=abc12345")}`,
  );
});

test("los metadatos del recurso protegido apuntan a /mcp y al Auth de Supabase", async ({
  request,
  baseURL,
}) => {
  for (const path of [
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/mcp",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const metadata = (await response.json()) as Record<string, unknown>;
    expect(metadata["resource"]).toBe(`${baseURL ?? ""}/mcp`);
    expect(metadata["authorization_servers"]).toEqual([
      expect.stringMatching(/\/auth\/v1$/) as unknown as string,
    ]);
  }
  expect((await request.get("/.well-known/oauth-protected-resource/otra")).status()).toBe(404);
});
