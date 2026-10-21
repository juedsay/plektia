import { expect, test } from "@playwright/test";

import { sessionCookieFor } from "./support/session";

const DENIED = "Esta cuenta no tiene acceso. Pedile una invitación al administrador.";

function locationOf(response: { headers(): Record<string, string> }): URL {
  return new URL(response.headers()["location"] ?? "", "http://app.invalid");
}

test.describe("login", () => {
  test("ofrece GitHub y Google, sin aviso de error", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: "Entrar con GitHub" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar con Google" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("después de un rechazo muestra siempre el mismo aviso", async ({ page }) => {
    await page.goto("/login?error=1");
    const alert = page.getByRole("alert");
    await expect(alert.locator("[data-alert-text]")).toHaveText(DENIED);
    await expect(alert.getByRole("link", { name: "Pedir una invitación" })).toHaveAttribute(
      "href",
      "/contacto",
    );
  });

  test("manda al proveedor con PKCE y guarda el verificador en una cookie segura", async ({
    request,
  }) => {
    const response = await request.get("/auth/login?provider=github&next=%2Fadmin", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    const location = locationOf(response);
    expect(location.pathname).toBe("/auth/v1/authorize");
    expect(location.searchParams.get("provider")).toBe("github");
    expect(location.searchParams.get("code_challenge_method")).toBe("s256");
    expect(location.searchParams.get("redirect_to")).toContain("/auth/callback");

    const verifier = response
      .headersArray()
      .filter(({ name }) => name.toLowerCase() === "set-cookie")
      .map(({ value }) => value)
      .find((value) => value.includes("code-verifier"));
    expect(verifier).toMatch(/HttpOnly/);
    expect(verifier).toMatch(/Secure/);
    expect(verifier).toMatch(/SameSite=Lax/);
  });

  for (const query of ["provider=azure&next=%2Fadmin", "next=%2Fadmin", ""]) {
    test(`sin un proveedor válido (${query || "sin parámetros"}) vuelve al login con el aviso`, async ({
      request,
    }) => {
      const response = await request.get(`/auth/login?${query}`, { maxRedirects: 0 });
      expect(response.status()).toBe(302);
      expect(locationOf(response).pathname).toBe("/login");
      expect(locationOf(response).searchParams.get("error")).toBe("1");
    });
  }
});

test.describe("callback", () => {
  for (const [caso, query] of [
    ["sin código", "?next=%2Fadmin"],
    ["con un código inválido", "?code=falso&next=%2Fadmin"],
    ["con la cuenta rechazada por el hook", "?error=access_denied&error_description=x"],
  ] as const) {
    test(`${caso} vuelve al login con el aviso`, async ({ request }) => {
      const response = await request.get(`/auth/callback${query}`, { maxRedirects: 0 });
      expect(response.status()).toBe(303);
      expect(locationOf(response).pathname).toBe("/login");
      expect(locationOf(response).searchParams.get("error")).toBe("1");
    });
  }

  test("un `next` hacia otro sitio se reemplaza por el panel", async ({ request }) => {
    const response = await request.get("/auth/callback?next=//evil.com", { maxRedirects: 0 });
    expect(locationOf(response).searchParams.get("next")).toBe("/admin");
  });
});

test.describe("con sesión", () => {
  // En serie y con una sola sesión: cada magic link nuevo invalida el anterior.
  test.describe.configure({ mode: "serial" });
  let cookie: string;

  test.beforeAll(async () => {
    cookie = await sessionCookieFor("owner@plektia.test");
  });

  test("entra al panel", async ({ request }) => {
    const response = await request.get("/admin", { headers: { cookie }, maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("Sesión iniciada");
    expect(response.headers()["cache-control"]).toBe("private, no-store");
  });

  test("/login con sesión manda directo al destino", async ({ request }) => {
    const response = await request.get("/login?next=%2Fadmin%2Flinks", {
      headers: { cookie },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(locationOf(response).pathname).toBe("/admin/links");
  });

  test("un logout sin formulario no rompe nada", async ({ request, baseURL }) => {
    const response = await request.post("/auth/logout", {
      headers: { origin: baseURL ?? "" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(locationOf(response).pathname).toBe("/login");
  });

  test("el logout borra las cookies de sesión", async ({ request, baseURL }) => {
    const response = await request.post("/auth/logout", {
      headers: { cookie, origin: baseURL ?? "" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(locationOf(response).pathname).toBe("/login");

    const cleared = response
      .headersArray()
      .filter(({ name }) => name.toLowerCase() === "set-cookie")
      .map(({ value }) => value)
      .filter((value) => value.includes("auth-token"));
    expect(cleared.length).toBeGreaterThan(0);
    for (const value of cleared) expect(value).toMatch(/Max-Age=0/);
  });
});
