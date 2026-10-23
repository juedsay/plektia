import { describe, expect, it } from "vitest";

import type { Link, Section } from "@/application/ports/link-repository";
import { describeCount, summarizePage } from "@/ui/view/page-summary";

function section(id: string, title: string, visible = true): Section {
  return { id, title, showTitle: true, visible, position: 0, version: 1 };
}

function link(sectionId: string | null, visible = true): Link {
  return {
    id: crypto.randomUUID(),
    sectionId,
    title: "x",
    url: "https://plektia.app",
    description: null,
    provider: "generic",
    providerHandle: null,
    tags: [],
    visible,
    position: 0,
    version: 1,
  };
}

describe("summarizePage", () => {
  it("cuenta los links de cada sección, en orden, y los ocultos aparte", () => {
    const summary = summarizePage({
      sections: [section("s1", "Redes"), section("s2", "Proyectos", false)],
      links: [link("s1"), link("s1", false), link("s2")],
    });
    expect(summary).toEqual({
      linkCount: 3,
      groups: [
        { title: "Redes", visible: true, linkCount: 2, hiddenCount: 1 },
        { title: "Proyectos", visible: false, linkCount: 1, hiddenCount: 0 },
      ],
    });
  });

  it("suma 'Sin sección' al final solo si tiene links", () => {
    expect(summarizePage({ sections: [], links: [] }).groups).toEqual([]);
    expect(summarizePage({ sections: [], links: [link(null)] }).groups).toEqual([
      { title: "Sin sección", visible: true, linkCount: 1, hiddenCount: 0 },
    ]);
  });
});

describe("describeCount", () => {
  it.each([
    [0, 0, "0 links"],
    [1, 0, "1 link"],
    [3, 1, "3 links, 1 oculto"],
    [5, 2, "5 links, 2 ocultos"],
  ])("%i links y %i ocultos → %s", (linkCount, hiddenCount, text) => {
    expect(describeCount(linkCount, hiddenCount)).toBe(text);
  });
});
