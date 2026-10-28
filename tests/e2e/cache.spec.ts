import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

// Política de caché (SPEC-public-page, "Render y caché"; ADR 0003). Las
// cabeceras se prueban en local y en producción; que la caché devuelva HIT
// solo en producción, porque en local la caché del Worker no existe.
const remote = Boolean(process.env["E2E_BASE_URL"]);

const PUBLIC = [
  ["/juedsay", "public, max-age=60, stale-while-revalidate=300"],
  ["/", "public, max-age=300, stale-while-revalidate=3600"],
  // La página oficial se edita desde el panel: se cachea como un perfil.
  ["/plektia", "public, max-age=60, stale-while-revalidate=300"],
  ["/legal/privacy", "public, max-age=300, stale-while-revalidate=3600"],
] as const;

test.describe("caché", () => {
  for (const [path, cacheControl] of PUBLIC) {
    test(`${path} es pública y sin cookies`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.headers()["cache-control"]).toBe(cacheControl);
      // Una cookie haría que la caché la guarde para todos: nunca en lo público.
      expect(response.headers()["set-cookie"]).toBeUndefined();
    });
  }

  for (const path of ["/login", "/contact"]) {
    test(`${path} nunca se cachea`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.headers()["cache-control"]).toBe("private, no-store");
    });
  }

  test("/plektia lleva la etiqueta del perfil oficial: editarla la purga", async ({ request }) => {
    test.skip(remote, "en producción Cloudflare saca la etiqueta antes de responder");
    const response = await request.get("/plektia");
    expect(response.headers()["cache-tag"]).toBe("site,profile:plektia");
  });

  test("la etiqueta de caché no llega al visitante (Cloudflare la saca)", async ({ request }) => {
    test.skip(!remote, "solo en producción: en local nadie la saca");
    const response = await request.get("/plektia");
    expect(response.headers()["cache-tag"]).toBeUndefined();
  });

  test("la segunda visita sale de la caché", async ({ request }) => {
    test.skip(!remote, "la caché del Worker no existe en local (ADR 0003)");
    // Un parámetro nuevo es una entrada nueva: la primera visita siempre la llena.
    const path = `/plektia?e2e=${randomBytes(4).toString("hex")}`;
    const first = await request.get(path);
    expect(first.headers()["cf-cache-status"]).toBe("MISS");
    const second = await request.get(path);
    expect(second.headers()["cf-cache-status"]).toBe("HIT");
  });
});
