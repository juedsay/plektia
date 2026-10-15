import { expect, test } from "@playwright/test";

// Verifica en la respuesta real (build de producción en workerd) las cabeceras
// que exige SPEC-platform. Si alguna falta, la CI bloquea el merge.
test.describe("cabeceras de seguridad", () => {
  test("la página responde con todas las cabeceras de seguridad", async ({ request }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);

    const headers = response.headers();
    expect(headers["strict-transport-security"]).toBe("max-age=63072000; includeSubDomains");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  test("la CSP de Astro limita scripts y estilos al propio sitio", async ({ page }) => {
    const response = await page.goto("/");
    const headerCsp = response?.headers()["content-security-policy"] ?? "";
    // Las páginas renderizadas en el Worker la reciben como cabecera; las
    // prerenderizadas, como <meta>. Se revisan las dos sin esperar al <meta>.
    const metaCsp = await page.evaluate(
      () =>
        document
          .querySelector('meta[http-equiv="content-security-policy"]')
          ?.getAttribute("content") ?? "",
    );
    const csp = `${headerCsp} ${metaCsp}`;

    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src[^;]*'self'/);
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  test("un script inyectado en línea no se ejecuta", async ({ page }) => {
    await page.goto("/");

    // Simula un XSS: un <script> inline agregado al documento debe ser bloqueado por la CSP.
    const violations: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") violations.push(message.text());
    });
    await page.evaluate(() => {
      const script = document.createElement("script");
      script.textContent = "window.__xss = true";
      document.body.appendChild(script);
    });

    expect(await page.evaluate(() => (window as unknown as { __xss?: boolean }).__xss)).toBe(
      undefined,
    );
    // Y el bloqueo lo hizo la CSP, no otro motivo.
    expect(violations.some((text) => text.includes("Content Security Policy"))).toBe(true);
  });
});
