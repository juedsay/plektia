// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";

import { connectPreviewSheet } from "@/ui/scripts/preview-sheet";

beforeAll(() => {
  // jsdom no trae matchMedia: la hoja solo escucha cambios de ancho.
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
});

function setup(sideBySide = false) {
  document.body.innerHTML = `
    <nav id="nav"><a href="/admin">Inicio</a></nav>
    <main>
      <div class="workspace" data-workspace>
        <div class="workspace-editor" id="editor">
          <form><button type="button" data-open-preview hidden>Ver</button></form>
        </div>
        <button type="button" data-open-preview hidden>Vista previa</button>
        <div data-close-preview hidden></div>
        <section data-preview-sheet>
          <h2>Vista previa</h2>
          <button type="button" data-close-preview hidden>Cerrar</button>
          <iframe></iframe>
        </section>
      </div>
    </main>`;
  const workspace = document.querySelector<HTMLElement>("[data-workspace]");
  if (!workspace) throw new Error("falta el workspace");
  connectPreviewSheet(workspace, { sideBySide: () => sideBySide });
  const byText = (text: string) => {
    const found = [...document.querySelectorAll<HTMLElement>("button")].find(
      (button) => button.textContent === text,
    );
    if (!found) throw new Error(`falta ${text}`);
    return found;
  };
  const sheet = () => document.querySelector<HTMLElement>("[data-preview-sheet]");
  const element = (id: string) => document.getElementById(id);
  return { byText, sheet, element };
}

describe("connectPreviewSheet", () => {
  it("con JavaScript, muestra los botones para abrirla y cerrarla", () => {
    const { byText } = setup();
    expect(byText("Ver").hidden).toBe(false);
    expect(byText("Vista previa").hidden).toBe(false);
    expect(byText("Cerrar").hidden).toBe(false);
  });

  it("abre la hoja como diálogo, con lo de atrás inerte y el foco en Cerrar", () => {
    const { byText, sheet, element } = setup();
    byText("Ver").click();
    expect(sheet()?.hasAttribute("data-open")).toBe(true);
    expect(sheet()?.getAttribute("role")).toBe("dialog");
    expect(sheet()?.getAttribute("aria-modal")).toBe("true");
    expect(element("editor")?.inert).toBe(true);
    expect(element("nav")?.inert).toBe(true);
    expect(document.activeElement).toBe(byText("Cerrar"));
  });

  it("Cerrar la cierra y devuelve el foco al botón que la abrió", () => {
    const { byText, sheet, element } = setup();
    const opener = byText("Vista previa");
    opener.click();
    byText("Cerrar").click();
    expect(sheet()?.hasAttribute("data-open")).toBe(false);
    expect(sheet()?.hasAttribute("role")).toBe(false);
    expect(element("editor")?.inert).toBe(false);
    expect(element("nav")?.inert).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it("Escape y tocar el fondo también la cierran", () => {
    const { byText, sheet } = setup();
    byText("Ver").click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(sheet()?.hasAttribute("data-open")).toBe(false);

    byText("Ver").click();
    document.querySelector<HTMLElement>("div[data-close-preview]")?.click();
    expect(sheet()?.hasAttribute("data-open")).toBe(false);
  });

  it("en escritorio (vista previa al lado) no abre nada", () => {
    const { byText, sheet } = setup(true);
    byText("Ver").click();
    expect(sheet()?.hasAttribute("data-open")).toBe(false);
  });
});
