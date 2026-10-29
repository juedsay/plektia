import { randomBytes } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { signIn } from "./support/session";

// Vista de estadísticas (tarea 28, SPEC-click-analytics "Panel"): visitar la
// página hace subir el número. Cuenta del avatar (su página actual es
// /avatar-demo) y una IP propia, para no compartir el límite por IP.
test.use({
  extraHTTPHeaders: { "cf-connecting-ip": `2001:db8:5b::${randomBytes(2).toString("hex")}` },
});

const totalOf = (text: string | null) => Number((text ?? "0").replace(/\D/g, ""));

test("visitar la página suma en el panel; la pantalla es accesible", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  await page.goto("/admin/estadisticas");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Estadísticas");
  const visits = page
    .locator(".stats-total")
    .filter({ has: page.locator(".stats-total-name", { hasText: /^Visitas$/ }) })
    .locator(".stats-total-value");
  const before = totalOf(await visits.textContent());

  // Una visita anónima (sin la cookie del dueño, que no cuenta).
  const anonymous = await context.browser()?.newContext({
    baseURL: baseURL ?? "",
    extraHTTPHeaders: { "cf-connecting-ip": `2001:db8:5c::${randomBytes(2).toString("hex")}` },
  });
  const visitor = await anonymous?.newPage();
  const beacon = visitor?.waitForResponse((response) => response.url().endsWith("/api/e"));
  await visitor?.goto("/avatar-demo");
  await beacon;
  await anonymous?.close();

  await expect
    .poll(async () => {
      await page.reload();
      return totalOf(await visits.textContent());
    })
    .toBeGreaterThan(before);

  // El período se elige con links: el de 30 días queda marcado.
  await page.getByRole("link", { name: "30 días" }).click();
  await expect(page.getByRole("link", { name: "30 días" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Son eventos, no personas", { exact: false })).toBeVisible();
  await expect(page.getByRole("figure", { name: "Visitas" })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});

test("sin sesión, /admin/estadisticas manda al login", async ({ request }) => {
  const response = await request.get("/admin/estadisticas", { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers()["location"]).toContain("/login?next=%2Fadmin%2Festadisticas");
});
