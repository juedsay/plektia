import { describe, expect, it } from "vitest";

import { landingLinks } from "@/content/landing";
import { toLink } from "@/content/links";

describe("toLink: links escritos a mano en el repo", () => {
  it("una ruta propia queda como ruta; una URL externa, validada", () => {
    expect(
      toLink({ title: "Entrar", url: "/login", description: "Con tu invitación" }, "a").url,
    ).toBe("/login");
    expect(toLink({ title: "Sitio", url: "https://plektia.app" }, "b").url).toBe(
      "https://plektia.app/",
    );
  });

  it.each([
    [{ title: "XSS", url: "javascript:alert(1)" }, /link inválido/],
    [{ title: "Sin descripción", url: "/login" }, /descripción/],
    [{ title: "Otro sitio", url: "//evil.test", description: "x" }, /no es válida/],
    [{ title: "a".repeat(81), url: "https://plektia.app" }, /link inválido/],
  ])("un link que no pasaría el panel rompe el build (%j)", (entry, error) => {
    expect(() => toLink(entry, "x")).toThrow(error);
  });
});

describe("landing", () => {
  it("sus salidas son links válidos hacia /plektia, el contacto y el login", () => {
    expect(landingLinks().map((link) => link.url)).toEqual(["/plektia", "/contact", "/login"]);
  });
});
