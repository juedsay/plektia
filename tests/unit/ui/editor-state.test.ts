import { describe, expect, it } from "vitest";

import type { Link, Section } from "@/application/ports/link-repository";
import {
  addLink,
  changedFields,
  groupLinks,
  inverseChanges,
  removeLink,
  replaceLink,
  suggestTitle,
} from "@/ui/view/editor-state";

function section(id: string, position: number): Section {
  return { id, title: id, showTitle: true, visible: true, position, version: 1 };
}

function link(
  id: string,
  sectionId: string | null,
  position: number,
  extra: Partial<Link> = {},
): Link {
  return {
    id,
    sectionId,
    title: id,
    url: `https://plektia.app/${id}`,
    description: null,
    provider: "generic",
    providerHandle: null,
    tags: [],
    visible: true,
    position,
    version: 1,
    ...extra,
  };
}

describe("groupLinks", () => {
  it("ordena las secciones y sus links, con 'Sin sección' al final", () => {
    const groups = groupLinks({
      sections: [section("proyectos", 1), section("redes", 0)],
      links: [
        link("b", "redes", 1),
        link("a", "redes", 0),
        link("suelto", null, 0),
        link("p", "proyectos", 0),
      ],
    });
    expect(
      groups.map((group) => [group.section?.id ?? null, group.links.map((item) => item.id)]),
    ).toEqual([
      ["redes", ["a", "b"]],
      ["proyectos", ["p"]],
      [null, ["suelto"]],
    ]);
  });

  it("sin secciones ni links, queda el grupo 'Sin sección' vacío para empezar", () => {
    expect(groupLinks({ sections: [], links: [] })).toEqual([{ section: null, links: [] }]);
  });

  it("con secciones y sin links sueltos, no muestra 'Sin sección'", () => {
    expect(
      groupLinks({ sections: [section("redes", 0)], links: [] }).map((group) => group.section?.id),
    ).toEqual(["redes"]);
  });
});

describe("replaceLink y addLink", () => {
  it("reemplaza solo el link con ese id y suma al final", () => {
    const content = { sections: [], links: [link("a", null, 0), link("b", null, 1)] };
    const updated = replaceLink(content, link("b", null, 1, { title: "nuevo", version: 2 }));
    expect(updated.links.map((item) => [item.id, item.title])).toEqual([
      ["a", "a"],
      ["b", "nuevo"],
    ]);
    expect(addLink(updated, link("c", null, 2)).links).toHaveLength(3);
  });
});

describe("suggestTitle", () => {
  it.each([
    ["https://www.instagram.com/juedsay/", "Instagram"],
    ["https://github.com/juedsay", "GitHub"],
    ["https://www.jsimon.vercel.app/", "jsimon.vercel.app"],
    ["mailto:hola@plektia.app", "Email"],
    ["  https://plektia.app  ", "plektia.app"],
    ["no es una url", ""],
  ])("%s → %s", (url, title) => {
    expect(suggestTitle(url)).toBe(title);
  });
});

describe("changedFields", () => {
  const saved = link("a", null, 0, {
    title: "Canal",
    url: "https://plektia.app",
    description: null,
  });

  it("sin cambios no manda nada", () => {
    expect(
      changedFields(saved, { title: " Canal ", url: "https://plektia.app", description: "" }),
    ).toEqual({});
  });

  it("manda solo lo que cambió; una descripción borrada va como null", () => {
    expect(
      changedFields(
        { ...saved, description: "vieja" },
        { title: "Canal nuevo", url: "https://plektia.app", description: "" },
      ),
    ).toEqual({ title: "Canal nuevo", description: null });
  });
});

describe("removeLink", () => {
  it("saca solo el link con ese id", () => {
    const content = { sections: [], links: [link("a", null, 0), link("b", null, 1)] };
    expect(removeLink(content, "a").links.map((item) => item.id)).toEqual(["b"]);
  });
});

describe("inverseChanges", () => {
  const before = link("a", null, 0, { title: "Canal", description: "vieja", visible: true });

  it("devuelve los valores anteriores de lo que cambió", () => {
    const after = { ...before, title: "Canal nuevo", description: null, version: 2 };
    expect(inverseChanges(before, after)).toEqual({ title: "Canal", description: "vieja" });
  });

  it("deshace mostrar u ocultar", () => {
    expect(inverseChanges(before, { ...before, visible: false })).toEqual({ visible: true });
  });

  it("sin cambios, no hay nada que deshacer", () => {
    expect(inverseChanges(before, { ...before, version: 2 })).toEqual({});
  });
});
