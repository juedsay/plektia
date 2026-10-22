import { expect, test } from "@playwright/test";

// Ningún correo (ni el personal ni otro) se muestra en las páginas públicas:
// el contacto va siempre por el formulario. Si una página llega a mostrar uno,
// este test falla.
const PAGES = [
  "/",
  "/plektia",
  "/juedsay",
  "/contact",
  "/login",
  "/legal/privacy",
  "/no-existe",
  "/sitemap.xml",
  "/robots.txt",
];
const EMAIL = /[\w.%+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}/i;

test("ninguna página pública muestra una dirección de email", async ({ request }) => {
  for (const path of PAGES) {
    const body = await (await request.get(path)).text();
    // `mailto:` en links de usuarios sí puede aparecer; acá se revisa lo propio
    // de Plektia, y el seed no tiene links con mailto.
    expect(EMAIL.exec(body)?.[0] ?? null, path).toBeNull();
  }
});
