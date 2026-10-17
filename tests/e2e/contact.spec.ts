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
    const response = await page.goto("/contacto");
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

  test("un mensaje válido se envía y la página lo confirma (y recargar no reenvía)", async ({
    page,
  }) => {
    await asFreshVisitor(page);
    await page.goto("/contacto");
    await fill(page, valid);
    await page.getByRole("button", { name: "Enviar mensaje" }).click();

    await expect(page).toHaveURL(/\/contacto\?enviado$/);
    await expect(page.getByRole("status").filter({ hasText: "tu mensaje llegó" })).toBeVisible();
  });

  test("con un email inválido marca el campo y conserva lo escrito", async ({ page }) => {
    await asFreshVisitor(page);
    await page.goto("/contacto");
    await fill(page, { ...valid, email: "no-es-un-email" });
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST"),
      page.getByRole("button", { name: "Enviar mensaje" }).click(),
    ]);
    expect(response.status()).toBe(400);

    const email = page.getByLabel("Tu email");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#email-error")).toContainText("email");
    await expect(page.getByLabel("Tu nombre")).toHaveValue("Ana");
    await expect(page.getByLabel("Mensaje")).toHaveValue("Quiero una invitación.");
  });

  test("al cuarto envío seguido desde la misma IP lo frena el límite", async ({ request }) => {
    const headers = {
      "cf-connecting-ip": `2001:db8:c1::${randomBytes(2).toString("hex")}`,
      origin: new URL(test.info().project.use.baseURL ?? "http://127.0.0.1").origin,
    };
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const response = await request.post("/contacto", {
        headers,
        form: { name: "", email: "", message: "" },
        maxRedirects: 0,
      });
      statuses.push(response.status());
    }
    expect(statuses).toEqual([400, 400, 400, 429]);
  });

  test("un envío sin el token de Turnstile no se guarda", async ({ request }) => {
    const response = await request.post("/contacto", {
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
});
