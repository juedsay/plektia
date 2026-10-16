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

  test("la fuente de la marca se sirve desde el propio sitio y se aplica, sin errores de CSP", async ({
    page,
    baseURL,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const font = page.waitForResponse((response) => response.url().endsWith(".woff2"));
    await page.goto("/juedsay");
    const response = await font;
    expect(new URL(response.url()).origin).toBe(new URL(baseURL ?? "").origin);
    expect(response.ok()).toBe(true);

    await page.evaluate(() => document.fonts.ready);
    const family = await page
      .getByRole("heading", { level: 1 })
      .evaluate((h1) => getComputedStyle(h1).fontFamily);
    expect(family).toContain("Bricolage Grotesque");
    expect(await page.evaluate(() => document.fonts.check('500 16px "Bricolage Grotesque"'))).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });

  test("un perfil trae Open Graph, íconos y datos estructurados", async ({ page }) => {
    await page.goto("/juedsay");
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "profile");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/og\.png$/,
    );
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.svg");
    const data = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}",
    ) as { "@type"?: string; mainEntity?: { alternateName?: string } };
    expect(data["@type"]).toBe("ProfilePage");
    expect(data.mainEntity?.alternateName).toBe("@juedsay");
  });

  test("sitemap y robots", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.headers()["content-type"]).toContain("application/xml");
    expect(await sitemap.text()).toMatch(/<loc>[^<]+\/juedsay<\/loc>/);
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /admin");
    for (const path of ["/favicon.svg", "/og.png", "/apple-touch-icon.png"]) {
      expect((await request.get(path)).ok(), path).toBe(true);
    }
  });
});
