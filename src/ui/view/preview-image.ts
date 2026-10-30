import {
  PREVIEW_IMAGE_HEIGHT,
  PREVIEW_IMAGE_MAX_BYTES,
  PREVIEW_IMAGE_WIDTH,
} from "@/domain/link-preview-image";

// La imagen de la vista previa, re-codificada en el navegador (SPEC-link-form,
// 7c-2): se recorta a 480 × 252 (cubriendo, sin deformar) y se exporta a WebP, o
// a JPEG si el navegador no sabe generar WebP (Safari). Dibujarla en un canvas
// descarta metadatos, animaciones y cualquier contenido escondido en el archivo.

export interface PreviewCandidate {
  readonly blob: Blob;
  /** Para mostrarla antes de guardar (la CSP del panel admite `data:`). */
  readonly dataUrl: string;
}

const QUALITIES = [0.85, 0.75, 0.65, 0.5];

export async function reencodePreviewImage(source: string): Promise<PreviewCandidate | null> {
  const image = new Image();
  image.src = source;
  try {
    await image.decode();
  } catch {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_IMAGE_WIDTH;
  canvas.height = PREVIEW_IMAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context || image.naturalWidth === 0 || image.naturalHeight === 0) return null;

  // "Cover": la imagen llena el recuadro y se recorta lo que sobra, centrado.
  const scale = Math.max(
    PREVIEW_IMAGE_WIDTH / image.naturalWidth,
    PREVIEW_IMAGE_HEIGHT / image.naturalHeight,
  );
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(
    image,
    (PREVIEW_IMAGE_WIDTH - width) / 2,
    (PREVIEW_IMAGE_HEIGHT - height) / 2,
    width,
    height,
  );

  let type: "image/webp" | "image/jpeg" = "image/webp";
  for (const quality of QUALITIES) {
    let blob = await toBlob(canvas, type, quality);
    if (type === "image/webp" && blob?.type !== "image/webp") {
      type = "image/jpeg";
      blob = await toBlob(canvas, type, quality);
    }
    if (blob?.type === type && blob.size <= PREVIEW_IMAGE_MAX_BYTES) {
      return { blob, dataUrl: canvas.toDataURL(type, quality) };
    }
  }
  return null;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}
