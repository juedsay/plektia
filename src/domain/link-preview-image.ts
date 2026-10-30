import {
  type AvatarError,
  type AvatarFormat,
  type InspectedAvatar,
  inspectStillImage,
} from "@/domain/avatar";
import type { Result } from "@/domain/result";

// Imagen de la vista previa de un artículo (SPEC-link-form, 7c-2). El navegador
// la recorta a 1.91:1 y la re-codifica (WebP, o JPEG en Safari); acá se valida
// otra vez con la misma inspección estricta del avatar.

export const PREVIEW_IMAGE_WIDTH = 480;
export const PREVIEW_IMAGE_HEIGHT = 252;
/** Peso máximo ya re-codificada (el bucket aplica el mismo límite). */
export const PREVIEW_IMAGE_MAX_BYTES = 80 * 1024;
/** Lo que se acepta traer del sitio, antes de re-codificar. */
export const PREVIEW_SOURCE_MAX_BYTES = 2 * 1024 * 1024;

const MESSAGES: Readonly<Record<AvatarError, string>> = {
  too_large: "La imagen pesa demasiado. Probá traerla de nuevo.",
  not_an_image: "No pudimos leer la imagen del artículo.",
  wrong_dimensions: "La imagen tiene que ser de 480 × 252.",
  animated: "La imagen no puede ser animada.",
  has_metadata: "La imagen trae datos de más: traela de nuevo.",
};

export function previewImageErrorMessage(error: AvatarError): string {
  return MESSAGES[error];
}

export function inspectPreviewImage(bytes: Uint8Array): Result<InspectedAvatar, AvatarError> {
  return inspectStillImage(bytes, {
    width: PREVIEW_IMAGE_WIDTH,
    height: PREVIEW_IMAGE_HEIGHT,
    maxBytes: PREVIEW_IMAGE_MAX_BYTES,
  });
}

const EXTENSIONS: Readonly<Record<AvatarFormat, string>> = { webp: "webp", jpeg: "jpg" };
const CONTENT_TYPES: Readonly<Record<string, string>> = { webp: "image/webp", jpg: "image/jpeg" };
const PREVIEW_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg)$/;

/** Ruta en el bucket: la carpeta de su dueño y un nombre nuevo cada vez. */
export function previewImagePath(ownerId: string, fileId: string, format: AvatarFormat): string {
  return `${ownerId}/${fileId}.${EXTENSIONS[format]}`;
}

export function isPreviewImagePath(path: string): boolean {
  return PREVIEW_PATH.test(path);
}

/** El tipo con el que se sube y se sirve, según la ruta (`null` si no es una). */
export function previewImageContentType(path: string): string | null {
  const extension = PREVIEW_PATH.exec(path)?.[1];
  return extension ? (CONTENT_TYPES[extension] ?? null) : null;
}

/**
 * El tipo real de una imagen traída de un sitio, por sus primeros bytes (el
 * `Content-Type` del sitio no alcanza): JPEG, PNG, WebP o GIF; si no, `null`.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  const starts = (...signature: number[]) => signature.every((byte, at) => bytes[at] === byte);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  return null;
}
