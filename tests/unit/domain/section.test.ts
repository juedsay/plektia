import { describe, expect, it } from "vitest";

import { parseSectionInput, parseSectionPatch } from "@/domain/section";

describe("parseSectionInput", () => {
  it("normaliza el título y completa los valores por defecto", () => {
    expect(parseSectionInput({ title: "  Redes  " })).toEqual({
      ok: true,
      value: { title: "Redes", showTitle: true, visible: true },
    });
  });

  it.each([
    ["vacío", { title: "  " }],
    ["largo", { title: "a".repeat(41) }],
    ["con salto de línea", { title: "Re\ndes" }],
    ["con texto invertido", { title: "Redes\u202e" }],
    ["sin título", {}],
  ])("rechaza un título %s", (_caso, input) => {
    const result = parseSectionInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.error.fields)).toContain("title");
  });
});

describe("parseSectionPatch", () => {
  it("acepta un cambio parcial", () => {
    expect(parseSectionPatch({ showTitle: false })).toEqual({
      ok: true,
      value: { showTitle: false },
    });
  });

  it("un cambio vacío es inválido", () => {
    expect(parseSectionPatch({}).ok).toBe(false);
  });
});
