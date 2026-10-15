import { expect, test } from "@playwright/test";

// Con un navegador real, porque la CSP solo la aplica el navegador: un pedido
// HTTP directo no habría detectado que `form-action 'self'` bloqueaba el
// login. Corre también contra producción después de cada deploy.
test("el botón de GitHub lleva al proveedor sin errores de CSP", async ({ page }) => {
  const cspErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Content Security Policy")) {
      cspErrors.push(message.text());
    }
  });

  await page.goto("/login");
  await page.getByText("Entrar con GitHub").click();
  // Local: Supabase (proveedor sin configurar). Producción: la página de GitHub.
  await page.waitForURL(/\/auth\/v1\/authorize|github\.com\/login/);
  expect(cspErrors).toEqual([]);
});
