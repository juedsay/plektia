import { describe, expect, it } from "vitest";

import type { PublicLink } from "@/application/ports/public-page-reader";
import type { LinkHighlight, LinkPlacement } from "@/domain/link";
import {
  iconLinksOf,
  initialOf,
  isProfileLink,
  linkMeta,
  listedLinks,
  shortUrl,
  topLinksOf,
} from "@/ui/view/public-link";

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

describe("fila de íconos", () => {
  const publicLink = (
    id: string,
    placement: LinkPlacement,
    highlight: LinkHighlight = "none",
  ): PublicLink => ({
    id,
    title: id,
    url: `https://plektia.app/${id}`,
    description: null,
    provider: "generic",
    providerHandle: null,
    placement,
    highlight,
    kind: null,
    previewImagePath: null,
  });
  const page = {
    sections: [
      {
        id: "s1",
        title: "Redes",
        showTitle: true,
        label: null,
        links: [publicLink("a", "icon"), publicLink("b", "list")],
      },
      { id: "s2", title: "Más", showTitle: true, label: null, links: [publicLink("c", "both")] },
    ],
    unsectionedLinks: [publicLink("d", "icon")],
  };

  it("junta los íconos en el orden de la página: secciones y después los sueltos", () => {
    expect(iconLinksOf(page).map((link) => link.id)).toEqual(["a", "c", "d"]);
  });

  it("la lista deja afuera los que son solo ícono", () => {
    expect(listedLinks(page.sections[0]?.links ?? []).map((link) => link.id)).toEqual(["b"]);
    expect(listedLinks(page.sections[1]?.links ?? []).map((link) => link.id)).toEqual(["c"]);
  });
});

describe("destacados arriba de todo", () => {
  const publicLink = (
    id: string,
    placement: LinkPlacement,
    highlight: LinkHighlight,
  ): PublicLink => ({
    id,
    title: id,
    url: `https://plektia.app/${id}`,
    description: null,
    provider: "generic",
    providerHandle: null,
    placement,
    highlight,
    kind: null,
    previewImagePath: null,
  });
  const page = {
    sections: [
      {
        id: "s1",
        title: "Redes",
        showTitle: true,
        label: null,
        links: [publicLink("a", "list", "top"), publicLink("b", "list", "accent")],
      },
    ],
    unsectionedLinks: [publicLink("c", "both", "top"), publicLink("d", "icon", "top")],
  };

  it("van en el orden de la página, sin los que son solo ícono", () => {
    expect(topLinksOf(page).map((link) => link.id)).toEqual(["a", "c"]);
  });

  it("no se repiten en su sección; el destacado con acento sí queda en su lugar", () => {
    expect(listedLinks(page.sections[0]?.links ?? []).map((link) => link.id)).toEqual(["b"]);
  });
});
