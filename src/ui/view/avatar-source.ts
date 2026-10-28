// La foto que elige la persona para su avatar, antes de recortarla en el
// navegador (SPEC-admin-panel, "Avatar"). Se valida por sus bytes, no por el
// nombre ni el tipo que dice el sistema: un SVG renombrado a .png no tiene la
// cabecera de un PNG. Y las dimensiones se leen de la cabecera ANTES de
// decodificar: una "bomba" de 20000 × 20000 se rechaza sin colgar la pestaña.

/** Peso máximo de la foto original (después se re-codifica a ≤ 200 KB). */
export const SOURCE_MAX_BYTES = 5 * 1024 * 1024;
/** Lado máximo y píxeles máximos de la foto original. */
export const SOURCE_MAX_SIDE = 8000;
export const SOURCE_MAX_PIXELS = 40_000_000;
/** Lado mínimo: más chico, el avatar se vería borroso. */
export const SOURCE_MIN_SIDE = 128;

export type SourceType = "jpeg" | "png" | "webp";

export type SourceError = "too_heavy" | "not_an_image" | "too_big" | "too_small";

const MESSAGES: Readonly<Record<SourceError, string>> = {
  too_heavy: "La foto pesa más de 5 MB. Probá con otra.",
  not_an_image: "No pudimos leer la foto. Probá con un JPEG, PNG o WebP.",
  too_big: "La foto es demasiado grande. Probá con una de menos de 8000 píxeles por lado.",
  too_small: "La foto es muy chica: tiene que tener al menos 128 píxeles por lado.",
};

export function sourceErrorMessage(error: SourceError): string {
  return MESSAGES[error];
}

interface Dimensions {
  readonly width: number;
  readonly height: number;
}

const bigEndian16 = (bytes: Uint8Array, at: number) =>
  ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
const bigEndian32 = (bytes: Uint8Array, at: number) =>
  ((bigEndian16(bytes, at) << 16) | bigEndian16(bytes, at + 2)) >>> 0;
const littleEndian16 = (bytes: Uint8Array, at: number) =>
  (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
const littleEndian24 = (bytes: Uint8Array, at: number) =>
  littleEndian16(bytes, at) | ((bytes[at + 2] ?? 0) << 16);
const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** El tipo real de la foto por sus primeros bytes, o `null` si no es una de las aceptadas. */
export function sniffSourceType(bytes: Uint8Array): SourceType | null {
  if (PNG_SIGNATURE.every((value, index) => bytes[index] === value)) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  return null;
}

/** Ancho y alto de un JPEG: el primer cuadro (SOF), saltando los segmentos de antes. */
function jpegDimensions(bytes: Uint8Array): Dimensions | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      return { height: bigEndian16(bytes, offset + 5), width: bigEndian16(bytes, offset + 7) };
    }
    const length = bigEndian16(bytes, offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

/** Ancho y alto de un WebP según su primer chunk. */
function webpDimensions(bytes: Uint8Array): Dimensions | null {
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8 ") {
    return {
      width: littleEndian16(bytes, 26) & 0x3fff,
      height: littleEndian16(bytes, 28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    const bits =
      ((bytes[21] ?? 0) |
        ((bytes[22] ?? 0) << 8) |
        ((bytes[23] ?? 0) << 16) |
        ((bytes[24] ?? 0) << 24)) >>>
      0;
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    return { width: littleEndian24(bytes, 24) + 1, height: littleEndian24(bytes, 27) + 1 };
  }
  return null;
}

/** Ancho y alto declarados en la cabecera, sin decodificar la imagen. */
export function sourceDimensions(bytes: Uint8Array, type: SourceType): Dimensions | null {
  if (type === "png") {
    // El primer chunk es IHDR: ancho y alto en 32 bits.
    if (ascii(bytes, 12, 4) !== "IHDR") return null;
    return { width: bigEndian32(bytes, 16), height: bigEndian32(bytes, 20) };
  }
  return type === "jpeg" ? jpegDimensions(bytes) : webpDimensions(bytes);
}

/** Valida la foto elegida antes de decodificarla: peso, tipo real y dimensiones. */
export function checkSource(
  size: number,
  bytes: Uint8Array,
): { ok: true; type: SourceType; dimensions: Dimensions } | { ok: false; error: SourceError } {
  if (size > SOURCE_MAX_BYTES) return { ok: false, error: "too_heavy" };
  const type = sniffSourceType(bytes);
  if (!type) return { ok: false, error: "not_an_image" };
  const dimensions = sourceDimensions(bytes, type);
  if (!dimensions || dimensions.width === 0 || dimensions.height === 0) {
    return { ok: false, error: "not_an_image" };
  }
  const { width, height } = dimensions;
  if (width > SOURCE_MAX_SIDE || height > SOURCE_MAX_SIDE || width * height > SOURCE_MAX_PIXELS) {
    return { ok: false, error: "too_big" };
  }
  if (width < SOURCE_MIN_SIDE || height < SOURCE_MIN_SIDE) return { ok: false, error: "too_small" };
  return { ok: true, type, dimensions };
}

// ── Recorte ─────────────────────────────────────────────────────────────────

/** Zoom mínimo (el cuadrado más grande que entra) y máximo. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export interface Crop {
  /** Centro del recorte, en píxeles de la imagen. */
  readonly centerX: number;
  readonly centerY: number;
  readonly zoom: number;
}

export interface CropSquare {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** El recorte inicial: centrado y con el cuadrado más grande que entra. */
export function initialCrop(image: Dimensions): Crop {
  return { centerX: image.width / 2, centerY: image.height / 2, zoom: MIN_ZOOM };
}

/** El cuadrado de la imagen que va al avatar: siempre adentro de la imagen. */
export function cropSquare(image: Dimensions, crop: Crop): CropSquare {
  const zoom = clamp(crop.zoom, MIN_ZOOM, MAX_ZOOM);
  const size = Math.min(image.width, image.height) / zoom;
  const half = size / 2;
  const centerX = clamp(crop.centerX, half, image.width - half);
  const centerY = clamp(crop.centerY, half, image.height - half);
  return { x: centerX - half, y: centerY - half, size };
}

/** Mueve el recorte (arrastrando o con las flechas), sin salirse de la imagen. */
export function moveCrop(image: Dimensions, crop: Crop, deltaX: number, deltaY: number): Crop {
  const square = cropSquare(image, {
    ...crop,
    centerX: crop.centerX + deltaX,
    centerY: crop.centerY + deltaY,
  });
  return { ...crop, centerX: square.x + square.size / 2, centerY: square.y + square.size / 2 };
}

/** Cambia el zoom manteniendo el centro (corrido si el cuadrado se saldría). */
export function zoomCrop(image: Dimensions, crop: Crop, zoom: number): Crop {
  const next = { ...crop, zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) };
  const square = cropSquare(image, next);
  return { ...next, centerX: square.x + square.size / 2, centerY: square.y + square.size / 2 };
}

// ── Re-codificación ─────────────────────────────────────────────────────────

/** Calidades que se prueban, de mejor a peor, hasta que el archivo entre en 200 KB. */
export const ENCODE_QUALITIES = [0.9, 0.8, 0.7, 0.6, 0.5] as const;
