// "Descargar PNG" del código QR (Inicio del panel). El QR es un SVG del propio
// sitio; acá se dibuja en un canvas grande (nítido para imprimir) y se baja como
// PNG. Sin JavaScript el botón no aparece y queda la descarga en SVG.

/** Lado del PNG, en píxeles: alcanza para imprimirlo a unos 8 cm a 300 ppp. */
export const QR_PNG_SIZE = 1024;

interface Options {
  /** Guarda el archivo; por defecto, con un link de descarga. */
  readonly save?: (blob: Blob, filename: string) => void;
}

const saveWithLink = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};

export function connectQrDownload(root: HTMLElement, { save = saveWithLink }: Options = {}): void {
  const image = root.querySelector<HTMLImageElement>("[data-qr-image]");
  const button = root.querySelector<HTMLButtonElement>("[data-qr-png]");
  if (!image || !button) return;
  button.hidden = false;

  button.addEventListener("click", () => {
    const draw = () => {
      const canvas = document.createElement("canvas");
      canvas.width = QR_PNG_SIZE;
      canvas.height = QR_PNG_SIZE;
      const context = canvas.getContext("2d");
      if (!context) return;
      // Sin suavizado: los módulos quedan con bordes netos.
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, QR_PNG_SIZE, QR_PNG_SIZE);
      canvas.toBlob((blob) => {
        if (blob) save(blob, button.dataset["qrPng"] ?? "qr.png");
      }, "image/png");
    };
    if (image.complete && image.naturalWidth > 0) draw();
    else image.addEventListener("load", draw, { once: true });
  });
}
