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

  it("sin descripción muestra la dirección en corto", () => {
    expect(linkMeta({ description: null, url: "https://www.twitch.tv/juedsay" })).toBe(
      "twitch.tv/juedsay",
    );
  });
});

describe("isProfileLink", () => {
  it("solo los links con handle del proveedor llevan rel=me", () => {
    expect(isProfileLink({ providerHandle: "juedsay" })).toBe(true);
    expect(isProfileLink({ providerHandle: null })).toBe(false);
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
