import { describe, expect, it } from "vitest";

import { initialOf, isProfileLink, linkMeta, shortUrl } from "@/ui/view/public-link";

describe("shortUrl", () => {
  it.each([
    ["https://www.youtube.com/@juedsay/", "youtube.com/@juedsay"],
    ["https://github.com/juedsay", "github.com/juedsay"],
    ["https://plektia.app/", "plektia.app"],
    ["https://plektia.app/a?utm_source=x#y", "plektia.app/a"],
    ["mailto:hola@plektia.app", "hola@plektia.app"],
  ])("%s → %s", (url, expected) => {
    expect(shortUrl(url)).toBe(expected);
  });
});

describe("linkMeta", () => {
  it("prefiere la descripción", () => {
    expect(linkMeta({ description: "Casos de estudio", url: "https://plektia.app" })).toBe(
      "Casos de estudio",
    );
  });

  it("sin descripción, un perfil de red social muestra @usuario", () => {
    expect(linkMeta({ description: null, url: "https://www.instagram.com/juedsay/" })).toBe(
      "@juedsay",
    );
    expect(linkMeta({ description: null, url: "https://www.linkedin.com/in/juedsay" })).toBe(
      "@juedsay",
    );
  });

  it("sin descripción ni perfil, muestra la dirección en corto", () => {
    expect(linkMeta({ description: null, url: "https://jsimon.vercel.app/" })).toBe(
      "jsimon.vercel.app",
    );
    expect(linkMeta({ description: null, url: "https://github.com/juedsay/plektia" })).toBe(
      "github.com/juedsay/plektia",
    );
  });
});

describe("isProfileLink", () => {
  it("lleva rel=me un canal con handle del proveedor o un perfil de red social", () => {
    expect(isProfileLink({ providerHandle: "juedsay", url: "https://www.twitch.tv/juedsay" })).toBe(
      true,
    );
    expect(
      isProfileLink({ providerHandle: null, url: "https://www.linkedin.com/in/juedsay" }),
    ).toBe(true);
  });

  it("un contenido suelto (un repo, un sitio) no", () => {
    expect(isProfileLink({ providerHandle: null, url: "https://github.com/juedsay/plektia" })).toBe(
      false,
    );
    expect(isProfileLink({ providerHandle: null, url: "https://jsimon.vercel.app/" })).toBe(false);
  });
});

describe("initialOf", () => {
  it.each([
    ["julián", "J"],
    ["  ñandú", "Ñ"],
    ["Élodie", "É"],
    ["", "?"],
  ])("%j → %s", (name, expected) => {
    expect(initialOf(name)).toBe(expected);
  });
});
