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
  await expect(page.getByRole("status").filter({ hasText: "Sin guardar" })).toBeVisible();

  const preview = page.frameLocator("iframe[data-draft-preview]");
  await expect(preview.locator("body")).toHaveAttribute("data-theme", "punto");
  await discard.click();
  await expect(page.getByRole("radio", { name: /^Patchera/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /^Filas/ })).toBeChecked();
  await expect(discard).toBeHidden();
  await expect(preview.locator("body")).toHaveAttribute("data-theme", "tecnico");
});

test.describe("en el celular", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Guardar aparece solo con cambios y la vista previa se abre desde donde se esté", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL ?? "", "avatar@plektia.test");
    await page.goto("/admin/page");
    const save = page.getByRole("button", { name: /^Guardar/ });
    await expect(save).toBeHidden();
    // Los estilos se deslizan de costado dentro de su fila: la página no.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );

    // Sin cambios: "Vista previa" flota abajo y abre la hoja.
    await page.getByRole("button", { name: "Vista previa" }).click();
    const sheet = page.getByRole("dialog", { name: "Vista previa" });
    await expect(sheet).toBeVisible();
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(sheet).toBeHidden();

    // Con un cambio al final de la pantalla, la barra aparece y "Ver" muestra el cambio.
    await page.getByRole("radio", { name: /^Pastillas/ }).check();
    await expect(save).toBeInViewport();
    await page.getByRole("button", { name: "Ver", exact: true }).click();
    await expect(sheet).toBeVisible();
    const preview = page.frameLocator("iframe[data-draft-preview]");
    await expect(preview.locator("[data-patchbay]")).toHaveAttribute("data-shape", "pills");
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: "Ver", exact: true })).toBeFocused();
  });
});

test("al guardar, el aviso flota abajo y se va solo", async ({ page, context, baseURL }) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  // Lo que se ve después de guardar (la Action redirige a ?guardado). No se
  // guarda de verdad: guardar manda el formulario entero y pisaría el estilo y
  // el acento que appearance.spec.ts cambia en esta cuenta, en paralelo.
  await page.goto("/admin/page?guardado");

  const toast = page.getByRole("status").filter({ hasText: "Guardado" });
  await expect(toast).toBeInViewport();
  await expect(toast.getByRole("link", { name: /Ver página/ })).toBeVisible();
  // Se va solo a los 6 s, sin que haga falta tocarlo.
  await expect(toast).toBeHidden({ timeout: 10_000 });
});

test.describe("atajos en el celular", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("los atajos llevan a cada parte y marcan dónde se está", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL ?? "", "avatar@plektia.test");
    await page.goto("/admin/page");
    const shortcuts = page.getByRole("navigation", { name: "Partes de la pantalla" });
    await shortcuts.getByRole("link", { name: "Modo" }).click();
    await expect(page.locator("#modo legend")).toBeInViewport();
    await expect(shortcuts.getByRole("link", { name: "Modo" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    // Los atajos siguen a la vista después de bajar.
    await expect(shortcuts).toBeInViewport();
  });
});
