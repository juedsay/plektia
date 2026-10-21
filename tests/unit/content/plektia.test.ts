import { describe, expect, it } from "vitest";

import { buildPlektiaPage } from "@/content/plektia";

describe("página oficial de Plektia", () => {
  it("se arma con contenido válido, con la bio elegida y el handle reservado", () => {
    const page = buildPlektiaPage();
    expect(page.handle).toBe("plektia");
    expect(page.bio).toBe("Todos tus links, unidos por un hilo.");
    expect(page.sections.map((s) => s.title)).toEqual(["Novedades", "Sobre Plektia", "Legal"]);
    for (const link of page.sections.flatMap((s) => s.links)) {
      expect(link.url).toMatch(/^(https:\/\/|\/(?!\/))/);
    }
  });

  it("las rutas propias quedan como rutas y no se comparte el repositorio", () => {
    const links = buildPlektiaPage().sections.flatMap((s) => s.links);
    expect(links.find((l) => l.title === "Entrar")?.url).toBe("/login");
    expect(links.some((l) => l.url.includes("github.com"))).toBe(false);
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
  it("sus salidas son links válidos hacia /plektia, el contacto y el login", async () => {
    const { landingLinks } = await import("@/content/landing");
    expect(landingLinks().map((l) => l.url)).toEqual(["/plektia", "/contact", "/login"]);
  });
});
