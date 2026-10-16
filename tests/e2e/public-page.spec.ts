import { expect, test } from "@playwright/test";

// Página pública con los datos del seed (supabase/seed.sql): el perfil
// `juedsay` con las secciones Redes, Proyectos y Artículos.
test.describe("página pública", () => {
  test("/{handle} muestra el perfil, sus secciones en orden y sus links", async ({ page }) => {
    const response = await page.goto("/juedsay");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("@juedsay", { exact: true })).toBeVisible();
    await expect(page.getByText("Streams, código y diseño")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Redes",
      "Proyectos",
      "Artículos",
    ]);

    const redes = page.getByRole("region", { name: "Redes" });
    await expect(redes.getByRole("link")).toHaveCount(3);
    const youtube = redes.getByRole("link", { name: /YouTube/ });
    await expect(youtube).toHaveAttribute("href", "https://www.youtube.com/@juedsay");
    // Sin descripción, el link muestra su dirección en corto; y es un perfil propio.
    await expect(youtube).toContainText("youtube.com/@juedsay");
    await expect(youtube).toHaveAttribute("rel", "me");
    // Misma pestaña (SPEC-public-page).
    await expect(youtube).not.toHaveAttribute("target", /.+/);
  });

  test("el handle no distingue mayúsculas y la URL canónica es /{handle}", async ({ page }) => {
    await page.goto("/JuedSay");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/juedsay$/);
  });

  test("la raíz muestra el perfil por defecto con su URL canónica", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("@juedsay", { exact: true })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/juedsay$/);
  });

  for (const path of ["/nadie-existe", "/a", "/con%20espacios"]) {
    test(`un handle inexistente o inválido (${path}) da 404 con el diseño de la página`, async ({
      page,
    }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Conocé Plektia" })).toHaveAttribute(
        "href",
        "/plektia",
      );
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    });
  }

  test("la página no pide nada a terceros al cargar", async ({ page, baseURL }) => {
    const origins = new Set<string>();
    page.on("request", (request) => origins.add(new URL(request.url()).origin));
    await page.goto("/juedsay");
    await page.waitForLoadState("networkidle");
    expect([...origins]).toEqual([new URL(baseURL ?? "").origin]);
  });
});
