// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { guardSingleSubmit } from "@/ui/scripts/single-submit";

describe("un solo envío", () => {
  it("el segundo submit se cancela y los botones quedan deshabilitados", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    document.body.innerHTML = `<form><button name="decision" value="approve">Autorizar</button></form>`;
    const form = document.querySelector("form");
    if (!form) throw new Error("sin formulario");
    guardSingleSubmit(form);

    const first = new Event("submit", { cancelable: true });
    form.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(false);
    expect(form.querySelector("button")?.disabled).toBe(true);
    expect(form.getAttribute("aria-busy")).toBe("true");

    const second = new Event("submit", { cancelable: true });
    form.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(true);
    vi.unstubAllGlobals();
  });
});
