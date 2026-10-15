import { expect, test } from "@playwright/test";

// SPEC-identity: sin sesión, todo /admin/* manda al login y vuelve después.
test.describe("acceso al panel sin sesión", () => {
  for (const [path, next] of [
    ["/admin", "/admin"],
    ["/admin/links?seccion=redes", "/admin/links?seccion=redes"],
    // Astro decodifica la ruta antes del middleware: la variante codificada también se protege.
    ["/%61dmin", "/admin"],
  ] as const) {
    test(`${path} redirige a /login con next`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(302);
      const location = new URL(response.headers()["location"] ?? "", "https://x.invalid");
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("next")).toBe(next);
      expect(response.headers()["cache-control"]).toBe("private, no-store");
      expect(response.headers()["x-frame-options"]).toBe("DENY");
    });
  }

  test("una cookie de sesión inventada no da acceso", async ({ request }) => {
    const response = await request.get("/admin", {
      maxRedirects: 0,
      headers: { cookie: "sb-127-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJ4In0" },
    });
    expect(response.status()).toBe(302);
  });

  test("la página pública no lee la sesión ni la marca como privada", async ({ request }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);
    expect(response.headers()["cache-control"] ?? "").not.toContain("private");
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });
});
