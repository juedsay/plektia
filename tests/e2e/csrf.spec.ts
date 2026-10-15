import { expect, test } from "@playwright/test";

// Corre último y con un solo pedido (proyecto "csrf" en playwright.config.ts).
// En el simulador local (miniflare, que usa `astro preview`), después de un 403
// que no lee el cuerpo del formulario, el pedido siguiente o simultáneo falla
// con "fetch failed". En Cloudflare no pasa: se verificó contra producción con
// pedidos simultáneos y seguidos. `security.checkOrigin` de Astro aplica a todo
// POST de formulario; el del logout es el que importa (el login es un link).
test("un formulario de otro sitio se rechaza (CSRF)", async ({ request }) => {
  const response = await request.post("/auth/logout", {
    form: { scope: "global" },
    headers: { origin: "https://evil.test" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(403);
});
