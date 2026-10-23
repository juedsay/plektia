import { describe, expect, it } from "vitest";

import {
  cancelText,
  dragKind,
  dragTitle,
  positionText,
  startText,
} from "@/ui/view/drag-announcements";
import { UNSECTIONED_GROUP } from "@/ui/view/editor-state";

const groupName = (groupKey: string) =>
  groupKey === UNSECTIONED_GROUP ? "Sin sección" : groupKey === "s-redes" ? "Redes" : "la sección";

describe("datos del arrastrable", () => {
  it.each([
    [{ title: "Twitch", kind: "link" }, "Twitch", "link"],
    [{ title: "Redes", kind: "section" }, "Redes", "section"],
    [{ title: 3, kind: "otra" }, "el elemento", undefined],
    [null, "el elemento", undefined],
  ])("%o → %s, %s", (data, title, kind) => {
    expect(dragTitle(data)).toBe(title);
    expect(dragKind(data)).toBe(kind);
  });
});

describe("anuncios", () => {
  it("al tomar y al cancelar", () => {
    expect(startText({ title: "Twitch" })).toBe("Tomaste Twitch. Usá las flechas para moverlo.");
    expect(cancelText({ title: "Twitch" })).toBe("Movimiento cancelado: Twitch volvió a su lugar.");
  });

  it("una sección dice su posición entre todas", () => {
    expect(
      positionText({
        data: { title: "Redes", kind: "section" },
        index: 0,
        group: undefined,
        linkId: "s-redes",
        order: null,
        sectionCount: 3,
        groupName,
      }),
    ).toBe("Sección Redes: posición 1 de 3");
  });

  it("un link usa el orden del arrastre en curso (dnd-kit no sigue el cambio de grupo)", () => {
    expect(
      positionText({
        data: { title: "Twitch", kind: "link" },
        index: 7,
        group: UNSECTIONED_GROUP,
        linkId: "twitch",
        order: { "s-redes": ["youtube", "twitch"], [UNSECTIONED_GROUP]: [] },
        sectionCount: 1,
        groupName,
      }),
    ).toBe("Twitch: posición 2 en Redes");
  });

  it("sin orden del arrastre, usa lo que informa dnd-kit", () => {
    const base = {
      data: { title: "Twitch", kind: "link" },
      index: 0,
      linkId: "twitch",
      order: null,
      sectionCount: 1,
      groupName,
    };
    expect(positionText({ ...base, group: "s-redes" })).toBe("Twitch: posición 1 en Redes");
    expect(positionText({ ...base, group: undefined })).toBe("Twitch: posición 1 en Sin sección");
  });
});
