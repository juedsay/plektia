import { expect, test } from "@playwright/test";

// Página pública con los datos del seed (supabase/seed.sql): el perfil
// `juedsay` con las secciones Redes, Proyectos y Artículos.
test.describe("página pública", () => {
  test("/{handle} muestra el perfil, sus secciones en orden y sus links", async ({ page }) => {
    const response = await page.goto("/juedsay");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".identity").getByText("@juedsay", { exact: true })).toBeVisible();
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
    // Sin descripción, un perfil de red social muestra "@usuario"; y lleva rel="me".
    await expect(youtube).toContainText("@juedsay");
    await expect(youtube).toHaveAttribute("rel", "me");
    // Misma pestaña (SPEC-public-page).
    await expect(youtube).not.toHaveAttribute("target", /.+/);
  });

  test("una segunda página de la misma cuenta tiene su /{handle} y solo sus links", async ({
    page,
  }) => {
    const response = await page.goto("/juedsay-qa");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Julián · QA");
    await expect(page.locator(".identity").getByText("@juedsay-qa", { exact: true })).toBeVisible();
    await expect(page.getByText("Testing, accesibilidad y rendimiento")).toBeVisible();
    const links = page.locator("main").getByRole("link", { name: /Portfolio|LinkedIn|Twitch/ });
    await expect(links).toHaveCount(2);
    await expect(page.getByRole("link", { name: /Portfolio/ })).toHaveAttribute(
      "href",
      "https://jsimon.vercel.app/",
    );

    // Y la primera página no muestra los links de la segunda.
    await page.goto("/juedsay");
    await expect(page.getByRole("link", { name: /Portfolio/ })).toHaveCount(0);
  });

  test("el handle no distingue mayúsculas y la URL canónica es /{handle}", async ({ page }) => {
    await page.goto("/JuedSay");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/juedsay$/);
  });

  test("la raíz es la landing de Plektia, con salida a /plektia y al login", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("plektia");
    await expect(page.getByText("Por ahora Plektia funciona por invitación.")).toBeVisible();
    const start = page.getByRole("region", { name: "Empezá acá" });
    await expect(start.getByRole("link", { name: /Conocé Plektia/ })).toHaveAttribute(
      "href",
      "/plektia",
    );
    await expect(start.getByRole("link", { name: /Entrar/ })).toHaveAttribute("href", "/login");
    // Sin el repositorio: no se comparte desde el sitio.
    await expect(page.locator('a[href*="github.com"]')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/$/);
  });

  test("/plektia es la página oficial, con el diseño de un perfil", async ({ page }) => {
    const response = await page.goto("/plektia");
    expect(response?.status()).toBe(200);
    // Pasa por el Worker: tiene las cabeceras de seguridad aunque no consulte la base.
    expect(response?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    await expect(page).toHaveTitle("Plektia · Página oficial");
    await expect(page.getByRole("link", { name: "Plektia: inicio" })).toHaveAttribute("href", "/");
    await expect(page.locator('a[href*="github.com"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plektia");
    await expect(page.locator(".identity").getByText("@plektia", { exact: true })).toBeVisible();
    await expect(page.getByText("Todos tus links, unidos por un hilo.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Novedades",
      "Sobre Plektia",
      "Legal",
    ]);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "profile");
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
    const sitemapText = await sitemap.text();
    expect(sitemapText).toMatch(/<loc>[^<]+\/juedsay<\/loc>/);
    expect(sitemapText).toMatch(/<loc>[^<]+\/juedsay-qa<\/loc>/);
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /admin");
    for (const path of ["/favicon.svg", "/og.png", "/apple-touch-icon.png"]) {
      expect((await request.get(path)).ok(), path).toBe(true);
    }
  });

  test("la política de privacidad está publicada y enlazada desde el pie de cada página", async ({
    page,
  }) => {
    for (const path of ["/", "/plektia", "/juedsay", "/contact", "/login"]) {
      await page.goto(path);
      await expect(
        page.getByRole("contentinfo").getByRole("link", { name: "Privacidad" }),
        path,
      ).toHaveAttribute("href", "/legal/privacy");
    }
    const response = await page.goto("/legal/privacy");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Política de privacidad");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/legal\/privacy$/,
    );
    // Lo que Google revisa para publicar el login, y lo que exige la Ley 25.326.
    for (const section of ["Quién es responsable", "Dónde se guardan", "Tus derechos"]) {
      await expect(page.getByRole("heading", { level: 2, name: section })).toBeVisible();
    }
  });
});
