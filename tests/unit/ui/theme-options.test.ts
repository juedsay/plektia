// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { ACCENTS, LINK_SHAPES, NAME_FONTS } from "@/domain/page";
import { THEME_RULES } from "@/domain/theme";
import { connectThemeOptions, optionFor } from "@/ui/scripts/theme-options";

const radios = (name: string, values: readonly string[], checked: string) =>
  values
    .map(
      (value) =>
        `<label><input type="radio" name="${name}" value="${value}"${value === checked ? " checked" : ""} /></label>`,
    )
    .join("");

/** El formulario como lo dibuja el servidor con Patchera guardada (admite todo). */
function setup(chosen = { accent: "cielo", linkShape: "rows", nameFont: "space_mono" }) {
  document.body.innerHTML = `
    <form data-theme-options data-chosen-accent="${chosen.accent}"
      data-chosen-linkshape="${chosen.linkShape}" data-chosen-namefont="${chosen.nameFont}">
      ${radios("theme", ["tecnico", "punto", "sumario"], "tecnico")}
      ${radios("accent", ACCENTS, chosen.accent)}
      ${radios("linkShape", LINK_SHAPES, chosen.linkShape)}
      ${radios("nameFont", NAME_FONTS, chosen.nameFont)}
    </form>`;
  const form = document.querySelector("form");
  if (!form) throw new Error("falta el formulario");
  connectThemeOptions(form);
  const pick = (name: string, value: string) => {
    const radio = form.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
    if (!radio) throw new Error(`falta ${name}=${value}`);
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const checked = (name: string) =>
    form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
  const visible = (name: string) =>
    [...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)]
      .filter((radio) => !radio.closest("label")?.hidden)
      .map((radio) => radio.value);
  return { pick, checked, visible };
}

describe("optionFor", () => {
  it("deja lo elegido si el estilo lo admite", () => {
    expect(optionFor("linkShape", "punto", "pills")).toBe("pills");
  });

  it("si no lo admite, el del estilo", () => {
    expect(optionFor("linkShape", "punto", "rows")).toBe(THEME_RULES.punto.defaultShape);
  });

  it("un estilo que no existe no decide nada", () => {
    expect(optionFor("accent", "inventado", "coral")).toBeNull();
  });
});

describe("connectThemeOptions", () => {
  let form: ReturnType<typeof setup>;
  beforeEach(() => {
    form = setup();
  });

  it("al elegir otro estilo, muestra solo lo que admite", () => {
    form.pick("theme", "punto");
    expect(form.visible("accent").sort()).toEqual([...THEME_RULES.punto.accents].sort());
    expect(form.visible("linkShape").sort()).toEqual([...THEME_RULES.punto.shapes].sort());
    expect(form.visible("nameFont").sort()).toEqual([...THEME_RULES.punto.fonts].sort());
  });

  it("lo que no aplica pasa a la opción por defecto del estilo", () => {
    form.pick("theme", "punto");
    expect(form.checked("accent")).toBe(THEME_RULES.punto.defaultAccent);
    expect(form.checked("linkShape")).toBe(THEME_RULES.punto.defaultShape);
    expect(form.checked("nameFont")).toBe(THEME_RULES.punto.defaultFont);
  });

  it("volver a un estilo que lo admite recupera lo elegido", () => {
    form.pick("theme", "punto");
    form.pick("theme", "tecnico");
    expect(form.checked("accent")).toBe("cielo");
    expect(form.checked("linkShape")).toBe("rows");
    expect(form.checked("nameFont")).toBe("space_mono");
    expect(form.visible("linkShape")).toEqual(LINK_SHAPES);
  });

  it("lo que el dueño elige en el estilo nuevo es lo que se recuerda", () => {
    form.pick("theme", "punto");
    form.pick("linkShape", "pills");
    form.pick("theme", "tecnico");
    expect(form.checked("linkShape")).toBe("pills");
  });

  it("recupera lo guardado aunque el estilo de entrada no lo admitiera", () => {
    // Guardado: Punto con filas (no aplica). El servidor marca tarjetas.
    form = setup({ accent: "coral", linkShape: "rows", nameFont: "fraunces" });
    form.pick("theme", "tecnico");
    expect(form.checked("linkShape")).toBe("rows");
  });
});
