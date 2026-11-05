// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectDraftPreview, DRAFT_DELAY_MS } from "@/ui/scripts/draft-preview";

function setup() {
  document.body.innerHTML = `
    <form>
      <input name="pageId" value="11111111-1111-4111-8111-111111111111" />
      <input name="displayName" value="Julián" />
      <label><input type="radio" name="theme" value="tecnico" checked /></label>
      <label><input type="radio" name="theme" value="punto" /></label>
    </form>
    <iframe></iframe>`;
  const form = document.querySelector("form");
  const frame = document.querySelector("iframe");
  if (!form || !frame) throw new Error("falta el formulario o el marco");
  const load = vi.fn<(frame: HTMLIFrameElement, url: string) => void>();
  connectDraftPreview(form, frame, { load });
  const type = (text: string) => {
    const field = form.querySelector<HTMLInputElement>('[name="displayName"]');
    if (!field) throw new Error("falta el nombre");
    field.value = text;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const choose = (theme: string) => {
    const radio = form.querySelector<HTMLInputElement>(`[name="theme"][value="${theme}"]`);
    if (!radio) throw new Error(`falta ${theme}`);
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const lastUrl = () => new URL(String(load.mock.lastCall?.[1]), "https://plektia.test");
  return { load, type, choose, lastUrl };
}

describe("connectDraftPreview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("al elegir una opción, carga la vista previa con el borrador", () => {
    const { load, choose, lastUrl } = setup();
    choose("punto");
    expect(load).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DRAFT_DELAY_MS);
    expect(load).toHaveBeenCalledOnce();
    expect(lastUrl().pathname).toBe("/admin/vista-previa");
    expect(lastUrl().searchParams.get("theme")).toBe("punto");
    expect(lastUrl().searchParams.has("pageId")).toBe(false);
  });

  it("mientras se escribe, recarga una sola vez al final", () => {
    const { load, type, lastUrl } = setup();
    for (const text of ["J", "Ju", "Jul", "Juli"]) {
      type(text);
      vi.advanceTimersByTime(DRAFT_DELAY_MS / 2);
    }
    vi.advanceTimersByTime(DRAFT_DELAY_MS);
    expect(load).toHaveBeenCalledOnce();
    expect(lastUrl().searchParams.get("displayName")).toBe("Juli");
  });

  it("si el borrador no cambió, no recarga", () => {
    const { load, choose } = setup();
    choose("punto");
    vi.advanceTimersByTime(DRAFT_DELAY_MS);
    choose("punto");
    vi.advanceTimersByTime(DRAFT_DELAY_MS);
    expect(load).toHaveBeenCalledOnce();
  });
});
