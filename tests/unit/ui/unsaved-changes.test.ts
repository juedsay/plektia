// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectThemeOptions } from "@/ui/scripts/theme-options";
import { connectUnsavedChanges } from "@/ui/scripts/unsaved-changes";

function setup() {
  document.body.innerHTML = `
    <form data-chosen-accent="hueso" data-chosen-linkshape="rows" data-chosen-namefont="bricolage">
      <input name="displayName" value="Julián" />
      <label><input type="radio" name="theme" value="tecnico" checked /></label>
      <label><input type="radio" name="theme" value="punto" /></label>
      <label><input type="radio" name="linkShape" value="rows" checked /></label>
      <label><input type="radio" name="linkShape" value="cards" /></label>
      <div>
        <p data-unsaved-status></p>
        <button type="button" data-discard hidden>Descartar</button>
        <button type="submit">Guardar cambios</button>
      </div>
    </form>`;
  const form = document.querySelector("form");
  if (!form) throw new Error("falta el formulario");
  connectThemeOptions(form);
  connectUnsavedChanges(form);
  const field = (selector: string) => {
    const found = form.querySelector<HTMLInputElement>(selector);
    if (!found) throw new Error(`falta ${selector}`);
    return found;
  };
  const choose = (name: string, value: string) => {
    const radio = field(`[name="${name}"][value="${value}"]`);
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const status = () => form.querySelector("[data-unsaved-status]")?.textContent;
  const discard = () => {
    const button = form.querySelector<HTMLButtonElement>("[data-discard]");
    if (!button) throw new Error("falta Descartar");
    return button;
  };
  return { form, field, choose, status, discard };
}

describe("connectUnsavedChanges", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sin cambios, no avisa ni ofrece descartar", () => {
    const { status, discard } = setup();
    expect(status()).toBe("");
    expect(discard().hidden).toBe(true);
  });

  it("un cambio avisa y ofrece descartar", () => {
    const { choose, status, discard, form } = setup();
    choose("theme", "punto");
    expect(status()).toBe("Tenés cambios sin guardar.");
    expect(discard().hidden).toBe(false);
    expect(form.hasAttribute("data-dirty")).toBe(true);
  });

  it("volver a lo guardado a mano también lo da por guardado", () => {
    const { field, status } = setup();
    const name = field('[name="displayName"]');
    name.value = "Otro";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    name.value = "Julián";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    expect(status()).toBe("");
  });

  it("Descartar vuelve a lo guardado, con las opciones del estilo guardado", () => {
    const { choose, field, status, discard } = setup();
    choose("theme", "punto");
    // Punto no admite filas: quedan ocultas y marcadas las tarjetas.
    expect(field('[name="linkShape"][value="rows"]').closest("label")?.hidden).toBe(true);

    discard().click();
    vi.runAllTimers();
    expect(field('[name="theme"][value="tecnico"]').checked).toBe(true);
    expect(field('[name="linkShape"][value="rows"]').checked).toBe(true);
    expect(field('[name="linkShape"][value="rows"]').closest("label")?.hidden).toBe(false);
    expect(status()).toBe("");
    expect(discard().hidden).toBe(true);
  });

  it("salir con cambios pide confirmación; al guardar, no", () => {
    const { choose, form } = setup();
    const leave = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(leave()).toBe(false);
    choose("theme", "punto");
    expect(leave()).toBe(true);
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(leave()).toBe(false);
  });
});
