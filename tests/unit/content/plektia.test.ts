import { describe, expect, it } from "vitest";

import { buildPlektiaPage } from "@/content/plektia";

describe("página oficial de Plektia", () => {
  it("se arma con contenido válido, con la bio elegida y el handle reservado", () => {
    const page = buildPlektiaPage();
    expect(page.handle).toBe("plektia");
    expect(page.bio).toBe("Todos tus links, unidos por un hilo.");
    expect(page.sections.map((s) => s.title)).toEqual(["Novedades", "Sobre Plektia"]);
    for (const link of page.sections.flatMap((s) => s.links)) {
      expect(link.url).toMatch(/^(https:\/\/|\/(?!\/))/);
    }
  });

  it("las rutas propias quedan como rutas y las externas detectan su proveedor", () => {
    // Un repositorio es de GitHub pero no es un perfil: sin handle, sin rel="me".
    const links = buildPlektiaPage().sections.flatMap((s) => s.links);
    expect(links.find((l) => l.title === "Entrar")?.url).toBe("/login");
    expect(links.find((l) => l.title === "Código abierto")).toMatchObject({
      provider: "github",
      providerHandle: null,
    });
  });

  it.each([
    [{ title: "XSS", url: "javascript:alert(1)" }, /link inválido/],
    [{ title: "Sin descripción", url: "/login" }, /descripción/],
    [{ title: "Otro sitio", url: "//evil.test", description: "x" }, /no es válida/],
    [{ title: "a".repeat(81), url: "https://plektia.app" }, /link inválido/],
  ])("un link que no pasaría el panel rompe el build (%j)", (entry, error) => {
    expect(() => buildPlektiaPage([{ title: "S", links: [entry] }])).toThrow(error);
  });
});

describe("landing", () => {
  it("sus salidas son links válidos hacia /plektia, el login y el código", async () => {
    const { landingLinks } = await import("@/content/landing");
    expect(landingLinks().map((l) => l.url)).toEqual([
      "/plektia",
      "/login",
      "https://github.com/juedsay/plektia",
    ]);
  });
});
