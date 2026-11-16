// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectQrDownload, QR_PNG_SIZE } from "@/ui/scripts/qr-download";

function setup() {
  document.body.innerHTML = `
    <details data-qr>
      <img data-qr-image src="/ana/qr.svg" alt="QR" />
      <button type="button" data-qr-png="plektia-ana-qr.png" hidden>Descargar PNG</button>
    </details>`;
  const root = document.querySelector<HTMLElement>("[data-qr]");
  const image = document.querySelector<HTMLImageElement>("[data-qr-image]");
  const button = document.querySelector<HTMLButtonElement>("[data-qr-png]");
  if (!root || !image || !button) throw new Error("falta el QR");
  const save = vi.fn<(blob: Blob, filename: string) => void>();
  connectQrDownload(root, { save });
  return { image, button, save };
}

/** Marca la imagen como cargada (jsdom no carga imágenes). */
function loaded(image: HTMLImageElement) {
  Object.defineProperty(image, "complete", { value: true, configurable: true });
  Object.defineProperty(image, "naturalWidth", { value: 41, configurable: true });
}

describe("connectQrDownload", () => {
  const drawn: { width: number; height: number }[] = [];

  beforeEach(() => {
    drawn.length = 0;
    // jsdom no dibuja: un canvas falso que anota lo que se pide.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      const { width, height } = this;
      return {
        imageSmoothingEnabled: true,
        drawImage: () => {
          drawn.push({ width, height });
        },
      } as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["png"], { type: "image/png" }));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("con JavaScript aparece el botón de PNG", () => {
    const { button } = setup();
    expect(button.hidden).toBe(false);
  });

  it("con la imagen cargada, baja un PNG grande con el nombre de la página", () => {
    const { image, button, save } = setup();
    loaded(image);
    button.click();
    expect(drawn).toEqual([{ width: QR_PNG_SIZE, height: QR_PNG_SIZE }]);
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]?.[1]).toBe("plektia-ana-qr.png");
  });

  it("si la imagen todavía no cargó, espera a que cargue", () => {
    const { image, button, save } = setup();
    button.click();
    expect(save).not.toHaveBeenCalled();
    loaded(image);
    image.dispatchEvent(new Event("load"));
    expect(save).toHaveBeenCalledOnce();
  });

  it("sin canvas (navegador sin soporte), no hace nada", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { image, button, save } = setup();
    loaded(image);
    button.click();
    expect(save).not.toHaveBeenCalled();
  });

  it("sin la imagen o el botón, no se conecta", () => {
    document.body.innerHTML = `<details data-qr></details>`;
    const root = document.querySelector<HTMLElement>("[data-qr]");
    if (!root) throw new Error("falta el QR");
    expect(() => {
      connectQrDownload(root);
    }).not.toThrow();
  });
});
