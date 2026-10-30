import { describe, expect, it } from "vitest";

import type { Link, Section } from "@/application/ports/link-repository";
import {
  addLink,
  applyLinkOrder,
  changedFields,
  groupLinks,
  inverseChanges,
  linkOrderOf,
  placeInOrder,
  planLinkMove,
  planSectionMove,
  removeLink,
  removeSection,
  restoreSection,
  changesNothing,
  replaceLink,
  replaceSection,
  suggestTitle,
  UNSECTIONED_GROUP,
} from "@/ui/view/editor-state";

function section(id: string, position: number): Section {
  return { id, title: id, showTitle: true, label: null, visible: true, position, version: 1 };
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
    placement: "list",
    highlight: "none",
    kind: null,
    previewImagePath: null,
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

  it("con secciones y sin links sueltos, 'Sin sección' sigue (vacía) para poder soltar ahí", () => {
    expect(
      groupLinks({ sections: [section("redes", 0)], links: [] }).map(
        (group) => group.section?.id ?? null,
      ),
    ).toEqual(["redes", null]);
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

  it("deshace el destacado", () => {
    expect(inverseChanges(before, { ...before, highlight: "top" })).toEqual({ highlight: "none" });
  });

  it("deshace el cambio de lugar (lista o ícono)", () => {
    expect(inverseChanges(before, { ...before, placement: "icon" })).toEqual({
      placement: "list",
    });
  });

  it("sin cambios, no hay nada que deshacer", () => {
    expect(inverseChanges(before, { ...before, version: 2 })).toEqual({});
  });
});

describe("planLinkMove", () => {
  const content = {
    sections: [section("redes", 0), section("proyectos", 1)],
    links: [
      link("a", "redes", 0),
      link("b", "redes", 1),
      link("c", "redes", 2),
      link("p", "proyectos", 0, { version: 4 }),
    ],
  };
  const positions = (plan: ReturnType<typeof planLinkMove>) =>
    plan?.content.links
      .map((item) => [item.id, item.sectionId, item.position])
      .sort((first, second) => String(first[0]).localeCompare(String(second[0])));

  it("reordena dentro de la misma sección", () => {
    const plan = planLinkMove(content, "c", "redes", 0);
    expect(plan?.sectionId).toBe("redes");
    expect(plan?.order.map((item) => item.id)).toEqual(["c", "a", "b"]);
    expect(positions(plan)).toEqual([
      ["a", "redes", 1],
      ["b", "redes", 2],
      ["c", "redes", 0],
      ["p", "proyectos", 0],
    ]);
  });

  it("pasa a otra sección; el destino lleva su lista completa y el origen queda compacto", () => {
    const plan = planLinkMove(content, "a", "proyectos", 1);
    expect(plan?.order).toEqual([
      { id: "p", version: 4 },
      { id: "a", version: 1 },
    ]);
    expect(positions(plan)).toEqual([
      ["a", "proyectos", 1],
      ["b", "redes", 0],
      ["c", "redes", 1],
      ["p", "proyectos", 0],
    ]);
  });

  it("puede ir a 'Sin sección' (null)", () => {
    const plan = planLinkMove(content, "b", null, 0);
    expect(plan?.sectionId).toBeNull();
    expect(plan?.order.map((item) => item.id)).toEqual(["b"]);
  });

  it("sin cambio de lugar, o con un link que no existe, no hay nada que hacer", () => {
    expect(planLinkMove(content, "b", "redes", 1)).toBeNull();
    expect(planLinkMove(content, "x", "redes", 0)).toBeNull();
  });

  it("un índice fuera de rango va al final", () => {
    expect(planLinkMove(content, "a", "proyectos", 99)?.order.map((item) => item.id)).toEqual([
      "p",
      "a",
    ]);
  });
});

describe("planSectionMove", () => {
  const content = {
    sections: [section("redes", 0), section("proyectos", 1), section("articulos", 2)],
    links: [],
  };

  it("mueve la sección y renumera las posiciones", () => {
    const plan = planSectionMove(content, "articulos", 0);
    expect(plan?.order.map((item) => item.id)).toEqual(["articulos", "redes", "proyectos"]);
    expect(plan?.content.sections.map((item) => [item.id, item.position])).toEqual([
      ["articulos", 0],
      ["redes", 1],
      ["proyectos", 2],
    ]);
  });

  it("sin cambio de lugar no hay nada que hacer", () => {
    expect(planSectionMove(content, "redes", 0)).toBeNull();
    expect(planSectionMove(content, "x", 1)).toBeNull();
  });
});

describe("orden durante el arrastre", () => {
  const content = {
    sections: [section("redes", 0)],
    links: [link("a", "redes", 0), link("b", "redes", 1), link("suelto", null, 0)],
  };

  it("arma el orden por grupo, con 'Sin sección' como clave propia", () => {
    expect(linkOrderOf(content)).toEqual({ redes: ["a", "b"], [UNSECTIONED_GROUP]: ["suelto"] });
  });

  it("dibuja los grupos con el orden del arrastre; sin arrastre, como están", () => {
    const groups = groupLinks(content);
    const moved = applyLinkOrder(groups, { redes: ["b", "suelto", "a"], [UNSECTIONED_GROUP]: [] });
    expect(moved.map((group) => group.links.map((item) => item.id))).toEqual([
      ["b", "suelto", "a"],
      [],
    ]);
    expect(applyLinkOrder(groups, null)).toEqual(groups);
  });

  it("encuentra dónde quedó un link: su sección (o null) y su posición", () => {
    const order = { redes: ["b", "a"], [UNSECTIONED_GROUP]: ["suelto"] };
    expect(placeInOrder(order, "a")).toEqual({ sectionId: "redes", index: 1 });
    expect(placeInOrder(order, "suelto")).toEqual({ sectionId: null, index: 0 });
    expect(placeInOrder(order, "x")).toBeNull();
  });
});

describe("changesNothing", () => {
  const redes = { ...section("redes", 0), title: "Redes", showTitle: true, visible: false };

  it("ocultar una sección ya oculta, o el mismo nombre con espacios, no cambia nada", () => {
    expect(changesNothing(redes, { visible: false })).toBe(true);
    expect(changesNothing(redes, { title: " Redes " })).toBe(true);
    expect(changesNothing(redes, { showTitle: true, visible: false })).toBe(true);
    expect(changesNothing(redes, { label: null })).toBe(true);
    expect(changesNothing(redes, { label: "  " })).toBe(true);
    expect(changesNothing({ ...redes, label: "Cara 1" }, { label: " Cara 1 " })).toBe(true);
  });

  it("cualquier campo distinto sí cambia", () => {
    expect(changesNothing(redes, { visible: true })).toBe(false);
    expect(changesNothing(redes, { title: "Otras" })).toBe(false);
    expect(changesNothing(redes, { showTitle: false })).toBe(false);
    expect(changesNothing(redes, { label: "Cara 1" })).toBe(false);
    expect(changesNothing({ ...redes, label: "Cara 1" }, { label: null })).toBe(false);
  });
});

describe("removeSection y replaceSection", () => {
  const content = {
    sections: [section("redes", 0), section("proyectos", 1)],
    links: [link("suelto", null, 0), link("b", "redes", 1), link("a", "redes", 0)],
  };

  it("los links de la sección borrada pasan al final de 'Sin sección', en su orden", () => {
    const result = removeSection(content, "redes");
    expect(result.sections.map((item) => item.id)).toEqual(["proyectos"]);
    expect(
      groupLinks(result)
        .at(-1)
        ?.links.map((item) => [item.id, item.position]),
    ).toEqual([
      ["suelto", 0],
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("deshacer el borrado devuelve la sección a su lugar con sus links", () => {
    const removed = removeSection(content, "redes");
    const restored = restoreSection(removed, content, "redes");
    expect(restored.sections.map((item) => item.id)).toEqual(["redes", "proyectos"]);
    expect(groupLinks(restored).map((group) => group.links.map((item) => item.id))).toEqual([
      ["a", "b"],
      [],
      ["suelto"],
    ]);
  });

  it("deshacer el borrado mantiene lo que cambió mientras tanto", () => {
    const removed = removeSection(content, "redes");
    const meanwhile = {
      ...removed,
      links: [
        ...removed.links.map((item) =>
          item.id === "b" ? { ...item, sectionId: "proyectos", title: "Movido" } : item,
        ),
        link("nuevo", null, 3),
      ],
    };
    const restored = restoreSection(meanwhile, content, "redes");
    expect(groupLinks(restored).map((group) => group.links.map((item) => item.id))).toEqual([
      ["a"],
      ["b"],
      ["suelto", "nuevo"],
    ]);
    expect(restored.links.find((item) => item.id === "b")?.title).toBe("Movido");
  });

  it("deshacer no duplica una sección que ya está", () => {
    expect(restoreSection(content, content, "redes")).toBe(content);
  });

  it("reemplaza solo la sección con ese id", () => {
    const renamed = { ...section("proyectos", 1), title: "Trabajos", version: 2 };
    expect(replaceSection(content, renamed).sections.map((item) => item.title)).toEqual([
      "redes",
      "Trabajos",
    ]);
  });
});
