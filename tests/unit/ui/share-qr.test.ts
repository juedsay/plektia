// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { mountShareQr } from "@/ui/scripts/share-qr";

function dialog(qr?: string) {
  document.body.innerHTML = `
    <dialog ${qr ? `data-share-qr="${qr}"` : ""}>
      <ul></ul>
      <p data-share-status></p>
    </dialog>`;
  const element = document.querySelector("dialog");
  if (!element) throw new Error("falta la ventana");
  return element;
}

describe("mountShareQr", () => {
  it("suma el desplegable antes del aviso, sin pedir la imagen todavía", () => {
    const element = dialog("/ana/qr.svg");
    mountShareQr(element, "plektia.ar/ana");
    const details = element.querySelector("details.share-qr");
    expect(details?.nextElementSibling?.hasAttribute("data-share-status")).toBe(true);
    expect(details?.querySelector("summary")?.textContent).toBe("Código QR");
    const image = details?.querySelector("img");
    expect(image?.getAttribute("src")).toBeNull();
    expect(image?.alt).toBe("Código QR de plektia.ar/ana");
    expect(details?.querySelector("a")?.getAttribute("href")).toBe("/ana/qr.svg?descargar");
  });

  it("al abrirlo pide la imagen", () => {
    const element = dialog("/ana/qr.svg");
    mountShareQr(element, "plektia.ar/ana");
    const details = element.querySelector<HTMLDetailsElement>("details.share-qr");
    if (!details) throw new Error("falta el desplegable");
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    expect(details.querySelector("img")?.getAttribute("src")).toBe("/ana/qr.svg");
  });

  it("abrir la ventana otra vez no lo duplica", () => {
    const element = dialog("/ana/qr.svg");
    mountShareQr(element, "plektia.ar/ana");
    mountShareQr(element, "plektia.ar/ana");
    expect(element.querySelectorAll("details.share-qr")).toHaveLength(1);
  });

  it("una página sin QR (las del sitio) no lo muestra", () => {
    const element = dialog();
    mountShareQr(element, "plektia.ar/legal/privacy");
    expect(element.querySelector("details")).toBeNull();
  });
});
