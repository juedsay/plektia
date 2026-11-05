import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

import { signIn } from "./support/session";

// Pantalla Página: la vista previa muestra lo elegido antes de guardar, y nada
// se publica hasta guardar. Cuenta del avatar (/avatar-demo), como apariencia.
test.use({
  extraHTTPHeaders: { "cf-connecting-ip": `2001:db8:0f::${randomBytes(2).toString("hex")}` },
});
test.describe.configure({ mode: "serial" });

test("lo elegido se ve en la vista previa sin publicarse", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await page.goto("/admin/page");
  const preview = page.frameLocator("iframe[data-draft-preview]");
  await expect(preview.locator("body")).toHaveAttribute("data-theme", "tecnico");

  await page.getByRole("radio", { name: /^Punto/ }).check();
  await page.getByRole("radio", { name: /^Pastillas/ }).check();
  await page.getByLabel("Nombre", { exact: true }).fill("Nombre de prueba");
  await expect(preview.locator("body")).toHaveAttribute("data-theme", "punto");
  await expect(preview.locator("[data-patchbay]")).toHaveAttribute("data-shape", "pills");
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText("Nombre de prueba");

  // Sin guardar, quien visita sigue viendo lo de antes.
  const visitorContext = await browser.newContext({ baseURL: baseURL ?? "" });
  const visitor = await visitorContext.newPage();
  await visitor.goto("/avatar-demo");
  await expect(visitor.locator("body")).toHaveAttribute("data-theme", "tecnico");
  await expect(visitor.getByRole("heading", { level: 1 })).not.toHaveText("Nombre de prueba");
  await visitorContext.close();

  // Y al volver a entrar, la vista previa es la de lo guardado.
  await page.reload();
  await expect(preview.locator("body")).toHaveAttribute("data-theme", "tecnico");
});

test("Guardar está a mano y Descartar vuelve a lo guardado", async ({ page, context, baseURL }) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await page.goto("/admin/page");
  const save = page.getByRole("button", { name: "Guardar cambios" });
  const discard = page.getByRole("button", { name: "Descartar" });
  // Al elegir un estilo arriba, la barra de guardado ya está a la vista.
  await page.getByRole("radio", { name: /^Punto/ }).check();
  await expect(save).toBeInViewport();
  await expect(
    page.getByRole("status").filter({ hasText: "Tenés cambios sin guardar." }),
  ).toBeVisible();

  const preview = page.frameLocator("iframe[data-draft-preview]");
  await expect(preview.locator("body")).toHaveAttribute("data-theme", "punto");
  await discard.click();
  await expect(page.getByRole("radio", { name: /^Patchera/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /^Filas/ })).toBeChecked();
  await expect(discard).toBeHidden();
  await expect(preview.locator("body")).toHaveAttribute("data-theme", "tecnico");
});
