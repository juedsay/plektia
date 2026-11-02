import { describe, expect, it } from "vitest";

import { parsePageSettings } from "@/domain/page";
import { AVAILABLE_THEMES, effectiveAppearance, THEME_RULES, THEMES } from "@/domain/theme";

const settings = { displayName: "Julián", bio: "", colorMode: "auto", showHandle: true };

describe("estilos", () => {
  it("cada variante pertenece a una familia y tiene sus valores por defecto entre los que admite", () => {
    for (const theme of THEMES) {
      const rules = THEME_RULES[theme];
      expect(rules.accents).toContain(rules.defaultAccent);
      expect(rules.shapes).toContain(rules.defaultShape);
      expect(rules.fonts).toContain(rules.defaultFont);
    }
  });

  it("las diez variantes están construidas y disponibles", () => {
    expect(AVAILABLE_THEMES).toEqual(THEMES);
  });

  it("se puede elegir un estilo disponible, pero no uno que no existe", () => {
    expect(parsePageSettings({ ...settings, theme: "punto" })).toMatchObject({
      ok: true,
      value: { theme: "punto" },
    });
    const unknown = parsePageSettings({ ...settings, theme: "neon" });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(Object.keys(unknown.error.fields)).toEqual(["theme"]);
  });

  it("lo que la variante no admite se reemplaza por lo suyo, sin tocar lo guardado", () => {
    const chosen = { accent: "cielo", linkShape: "rows", nameFont: "space_mono" } as const;
    expect(effectiveAppearance("punto", chosen)).toEqual({
      accent: "coral",
      linkShape: "cards",
      nameFont: "fraunces",
    });
    expect(effectiveAppearance("tecnico", chosen)).toEqual(chosen);
    expect(
      effectiveAppearance("punto", { accent: "turquesa", linkShape: "pills", nameFont: "nunito" }),
    ).toEqual({ accent: "turquesa", linkShape: "pills", nameFont: "nunito" });
  });
});
