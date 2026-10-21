import { randomBytes } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";

// Formulario de contacto contra el build local, con las claves de prueba de
// Turnstile (siempre aprueban). Cada test usa su propia IP: el límite es de 3
// envíos por minuto por IP y su estado local sobrevive entre corridas.
test.skip(Boolean(process.env["E2E_BASE_URL"]), "solo en local: cambia la IP de cada test");

// La IP simulada (`cf-connecting-ip`) es solo para el Worker local: Cloudflare
// rechaza con 403 a quien la manda desde afuera, y sin esto el script de
// Turnstile no cargaría.
test.beforeEach(async ({ page }) => {
  await page.route("https://challenges.cloudflare.com/**", async (route) => {
    const headers = { ...route.request().headers() };
    delete headers["cf-connecting-ip"];
    await route.continue({ headers });
  });
});

async function asFreshVisitor(page: Page) {
  const ip = `2001:db8:c0::${randomBytes(2).toString("hex")}`;
  await page.setExtraHTTPHeaders({ "cf-connecting-ip": ip });
}

async function fill(page: Page, values: { name: string; email: string; message: string }) {
  await page.getByLabel("Tu nombre").fill(values.name);
  await page.getByLabel("Tu email").fill(values.email);
  await page.getByLabel("Mensaje").fill(values.message);
  // El widget de prueba de Turnstile completa su token solo.
  await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue("", {
    timeout: 15_000,
  });
}

const valid = { name: "Ana", email: "ana@example.com", message: "Quiero una invitación." };

test.describe("contacto", () => {
  test("la página no muestra ningún correo y carga Turnstile sin errores de CSP", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const response = await page.goto("/contact");
    expect(response?.status()).toBe(200);
    expect(response?.headers()["content-security-policy"]).toContain(
      "https://challenges.cloudflare.com",
    );
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    expect(await page.content()).not.toMatch(/[\w.+-]+@(gmail|plektia)\./);
    await expect(page.locator('input[name="cf-turnstile-response"]')).toBeAttached({
      timeout: 15_000,
    });
    // Sin errores de CSP: ni Turnstile ni el script propio de la página (compartir) quedan bloqueados.
    expect(errors.filter((e) => /Content Security Policy/i.test(e))).toEqual([]);
  });

  test("un mensaje válido se envía: el botón se bloquea y el éxito ofrece cómo seguir", async ({
    page,
  }) => {
    await asFreshVisitor(page);
    await page.goto("/contact");
    await fill(page, valid);
    const submit = page.getByRole("button", { name: "Enviar mensaje" });
    await submit.click();

    await expect(page).toHaveURL(/\/contact\?enviado$/);
    const done = page.getByRole("status").filter({ hasText: "tu mensaje llegó" });
    await expect(done).toBeVisible();
    await expect(done).toBeFocused();
    await expect(page.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("link", { name: "Enviar otro mensaje" })).toHaveAttribute(
      "href",
      "/contact",
    );
    // El borrador se borra al enviar: el formulario nuevo arranca vacío.
    await page.getByRole("link", { name: "Enviar otro mensaje" }).click();
    await expect(page.getByLabel("Tu nombre")).toHaveValue("");
  });

  test("con un email inválido no envía: marca el campo y le pasa el foco", async ({ page }) => {
    await asFreshVisitor(page);
    await page.goto("/contact");
    await fill(page, { ...valid, email: "testmail.com" });
    let posted = false;
    page.on("request", (r) => {
      if (r.method() === "POST") posted = true;
    });
    await page.getByRole("button", { name: "Enviar mensaje" }).click();

    const email = page.getByLabel("Tu email");
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#email-error")).toHaveText("Revisá tu email: no parece válido.");
    await expect(page.getByRole("alert")).toContainText("Revisá los campos marcados.");
    expect(posted).toBe(false);

    // Al corregirlo, el error se va sin tener que reenviar.
    await email.fill("ana@example.com");
    await expect(page.locator("#email-error")).toBeHidden();
  });

  test("lo escrito sobrevive a una recarga (borrador de la pestaña)", async ({ page }) => {
    await page.goto("/contact");
    await page.getByLabel("Tu nombre").fill("Ana");
    await page.getByLabel("Mensaje").fill("Borrador a medias");
    await page.reload();
    await expect(page.getByLabel("Tu nombre")).toHaveValue("Ana");
    await expect(page.getByLabel("Mensaje")).toHaveValue("Borrador a medias");
  });

  test("sin JavaScript, el servidor valida igual y conserva lo escrito", async ({ request }) => {
    const response = await request.post("/contact", {
      headers: {
        "cf-connecting-ip": `2001:db8:c3::${randomBytes(2).toString("hex")}`,
        origin: new URL(test.info().project.use.baseURL ?? "http://127.0.0.1").origin,
      },
      form: { ...valid, email: "testmail.com" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(400);
    const html = await response.text();
    expect(html).toContain("Revisá tu email: no parece válido.");
    expect(html).toContain('value="Ana"');
    expect(html).toContain("Quiero una invitación.");
  });

  test("al cuarto envío seguido desde la misma IP lo frena el límite", async ({ request }) => {
    const headers = {
      "cf-connecting-ip": `2001:db8:c1::${randomBytes(2).toString("hex")}`,
      origin: new URL(test.info().project.use.baseURL ?? "http://127.0.0.1").origin,
    };
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const response = await request.post("/contact", {
        headers,
        form: { name: "", email: "", message: "" },
        maxRedirects: 0,
      });
      statuses.push(response.status());
    }
    expect(statuses).toEqual([400, 400, 400, 429]);
  });

  test("un envío sin el token de Turnstile no se guarda", async ({ request }) => {
    const response = await request.post("/contact", {
      headers: {
        "cf-connecting-ip": `2001:db8:c2::${randomBytes(2).toString("hex")}`,
        origin: new URL(test.info().project.use.baseURL ?? "http://127.0.0.1").origin,
      },
      form: valid,
      maxRedirects: 0,
    });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain("No pudimos confirmar que no sos un robot");
  });

  test("la ruta vieja /contacto redirige a /contact", async ({ request }) => {
    const response = await request.get("/contacto", { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers()["location"]).toBe("/contact");
  });
});
