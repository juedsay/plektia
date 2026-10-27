// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectLivePreview, RELOAD_DELAY_MS } from "@/ui/scripts/live-preview";
import { PAGE_CHANGED_EVENT } from "@/ui/view/page-changed";

const WORKSPACE = `
  <div data-workspace>
    <div role="tablist" hidden>
      <button role="tab" id="tab-editar" aria-controls="panel-editar" aria-selected="true">Editar</button>
      <button role="tab" id="tab-vista" aria-controls="panel-vista" aria-selected="false" tabindex="-1">
        Vista previa
      </button>
    </div>
    <div id="panel-editar" role="tabpanel">editor</div>
    <section id="panel-vista" role="tabpanel"><iframe data-preview-frame></iframe></section>
  </div>
`;

function setup() {
  document.body.innerHTML = WORKSPACE;
  const root = document.querySelector<HTMLElement>("[data-workspace]");
  if (!root) throw new Error("falta el workspace");
  const reload = vi.fn();
  connectLivePreview(root, { reload });
  const tab = (name: string) => {
    const found = [...document.querySelectorAll<HTMLButtonElement>("[role='tab']")].find(
      (candidate) => candidate.textContent.includes(name),
    );
    if (!found) throw new Error(`falta la pestaña ${name}`);
    return found;
  };
  const panel = (id: string) => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`falta el panel ${id}`);
    return found;
  };
  return { reload, tab, panel };
}

describe("connectLivePreview · recarga", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("recarga la vista previa una sola vez tras varios cambios seguidos", () => {
    const { reload } = setup();
    document.dispatchEvent(new Event(PAGE_CHANGED_EVENT));
    document.dispatchEvent(new Event(PAGE_CHANGED_EVENT));
    expect(reload).not.toHaveBeenCalled();

    vi.advanceTimersByTime(RELOAD_DELAY_MS);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledWith(document.querySelector("[data-preview-frame]"));
  });
});

describe("connectLivePreview · pestañas", () => {
  it("muestra las pestañas con 'Editar' elegida y la vista previa oculta", () => {
    const { tab, panel } = setup();
    expect(document.querySelector<HTMLElement>("[role='tablist']")?.hidden).toBe(false);
    expect(tab("Editar").getAttribute("aria-selected")).toBe("true");
    expect(panel("panel-editar").hasAttribute("data-inactive")).toBe(false);
    expect(panel("panel-vista").hasAttribute("data-inactive")).toBe(true);
  });

  it("al tocar 'Vista previa' cambia de panel", () => {
    const { tab, panel } = setup();
    tab("Vista previa").click();
    expect(tab("Vista previa").getAttribute("aria-selected")).toBe("true");
    expect(tab("Editar").tabIndex).toBe(-1);
    expect(panel("panel-editar").hasAttribute("data-inactive")).toBe(true);
    expect(panel("panel-vista").hasAttribute("data-inactive")).toBe(false);
  });

  it("con las flechas, Inicio y Fin se pasa de pestaña y el foco la sigue", () => {
    const { tab } = setup();
    const press = (target: HTMLElement, key: string) =>
      target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

    press(tab("Editar"), "ArrowRight");
    expect(document.activeElement).toBe(tab("Vista previa"));
    press(tab("Vista previa"), "ArrowRight");
    expect(document.activeElement).toBe(tab("Editar"));
    press(tab("Editar"), "ArrowLeft");
    expect(document.activeElement).toBe(tab("Vista previa"));
    press(tab("Vista previa"), "Home");
    expect(document.activeElement).toBe(tab("Editar"));
    press(tab("Editar"), "End");
    expect(document.activeElement).toBe(tab("Vista previa"));
    press(tab("Vista previa"), "a");
    expect(tab("Vista previa").getAttribute("aria-selected")).toBe("true");
  });
});
