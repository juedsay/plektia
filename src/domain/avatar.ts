import { err, ok, type Result } from "@/domain/result";

// Avatar de una página (SPEC-admin-panel, "Avatar"). El navegador lo recorta y lo
// re-codifica a WebP de 512 × 512; acá se vuelve a validar con los bytes, sin
// creerle al nombre ni al tipo que manda el navegador: un SVG o un PNG renombrado
// no tienen la cabecera de un WebP.

/** Lado del avatar, en píxeles. */
export const AVATAR_SIZE = 512;
/** Peso máximo del WebP ya re-codificado (el bucket aplica el mismo límite). */
export const AVATAR_MAX_BYTES = 200 * 1024;

export type AvatarError =
  "too_large" | "not_webp" | "wrong_dimensions" | "animated" | "has_metadata";

const MESSAGES: Readonly<Record<AvatarError, string>> = {
  too_large: "La imagen pesa demasiado. Probá con otra o recortala de nuevo.",
  not_webp: "No pudimos leer la imagen. Probá con un JPEG, PNG o WebP.",
  wrong_dimensions: "La imagen tiene que ser cuadrada, de 512 × 512.",
  animated: "Por ahora el avatar no puede ser animado.",
  has_metadata: "La imagen trae datos de la cámara o la ubicación: recortala de nuevo.",
};

export function avatarErrorMessage(error: AvatarError): string {
  return MESSAGES[error];
}

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

const uint16 = (bytes: Uint8Array, at: number) => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
const uint24 = (bytes: Uint8Array, at: number) => uint16(bytes, at) | ((bytes[at + 2] ?? 0) << 16);
const uint32 = (bytes: Uint8Array, at: number) =>
  (uint24(bytes, at) | ((bytes[at + 3] ?? 0) << 24)) >>> 0;

// Banderas del chunk VP8X (especificación del contenedor WebP).
const VP8X_ANIMATION = 0x02;
const VP8X_XMP = 0x04;
const VP8X_EXIF = 0x08;

interface Dimensions {
  readonly width: number;
  readonly height: number;
}

interface Chunk {
  readonly fourCc: string;
  /** Dónde empiezan sus datos y cuántos bytes declara. */
  readonly start: number;
  readonly size: number;
}

/**
 * Los chunks del contenedor RIFF. Tienen que cubrir el archivo justo: un tamaño
 * en cero, corto o más largo que el archivo hace que no sea un WebP.
 */
function readChunks(bytes: Uint8Array): readonly Chunk[] | null {
  const chunks: Chunk[] = [];
  let offset = 12;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) return null;
    const size = uint32(bytes, offset + 4);
    const start = offset + 8;
    // Cada chunk ocupa un número par de bytes (se rellena con uno si hace falta).
    const end = start + size + (size % 2);
    if (end > bytes.length) return null;
    chunks.push({ fourCc: ascii(bytes, offset, 4), start, size });
    offset = end;
  }
  return chunks;
}

// Lo mínimo que tiene que traer cada chunk para leer su tamaño.
const VP8_HEADER_BYTES = 10;
const VP8L_HEADER_BYTES = 5;
const VP8X_BYTES = 10;

/** Ancho y alto de la imagen de un chunk `VP8 ` o `VP8L`. */
function readImage(bytes: Uint8Array, chunk: Chunk): Result<Dimensions, AvatarError> {
  const data = chunk.start;
  if (chunk.fourCc === "VP8 " && chunk.size >= VP8_HEADER_BYTES) {
    // Cuadro clave con su código de inicio; el tamaño son 14 bits.
    const keyFrame = ((bytes[data] ?? 1) & 0x01) === 0;
    const startCode =
      bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a;
    if (!keyFrame || !startCode) return err("not_webp");
    return ok({
      width: uint16(bytes, data + 6) & 0x3fff,
      height: uint16(bytes, data + 8) & 0x3fff,
    });
  }
  if (chunk.fourCc === "VP8L" && chunk.size >= VP8L_HEADER_BYTES) {
    if (bytes[data] !== 0x2f) return err("not_webp");
    const bits = uint32(bytes, data + 1);
    return ok({ width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 });
  }
  return err("not_webp");
}

/** Ancho y alto de un WebP, o el motivo por el que no es válido. */
function readWebp(bytes: Uint8Array): Result<Dimensions, AvatarError> {
  if (bytes.length < 20) return err("not_webp");
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return err("not_webp");
  // El tamaño declarado tiene que ser el real: nada escondido después del WebP.
  if (uint32(bytes, 4) !== bytes.length - 8) return err("not_webp");

  const chunks = readChunks(bytes);
  const [first] = chunks ?? [];
  if (!first) return err("not_webp");
  if (first.fourCc !== "VP8X") return readImage(bytes, first);

  // Formato extendido: banderas y lienzo, y después la imagen, del mismo tamaño.
  if (first.size !== VP8X_BYTES) return err("not_webp");
  const flags = bytes[first.start] ?? 0;
  if (flags & VP8X_ANIMATION) return err("animated");
  if (flags & (VP8X_EXIF | VP8X_XMP)) return err("has_metadata");
  const canvas = {
    width: uint24(bytes, first.start + 4) + 1,
    height: uint24(bytes, first.start + 7) + 1,
  };
  const imageChunk = chunks?.find((chunk) => chunk.fourCc === "VP8 " || chunk.fourCc === "VP8L");
  if (!imageChunk) return err("not_webp");
  const image = readImage(bytes, imageChunk);
  if (!image.ok) return image;
  if (image.value.width !== canvas.width || image.value.height !== canvas.height) {
    return err("not_webp");
  }
  return ok(canvas);
}

/** Valida un avatar ya re-codificado: peso, WebP de verdad, quieto, sin metadatos y 512 × 512. */
export function inspectAvatar(bytes: Uint8Array): Result<Dimensions, AvatarError> {
  if (bytes.length > AVATAR_MAX_BYTES) return err("too_large");
  const read = readWebp(bytes);
  if (!read.ok) return read;
  if (read.value.width !== AVATAR_SIZE || read.value.height !== AVATAR_SIZE) {
    return err("wrong_dimensions");
  }
  return read;
}

/** Ruta de un avatar en el bucket: la carpeta de su dueño y un nombre nuevo cada vez. */
export function avatarPath(ownerId: string, fileId: string): string {
  return `${ownerId}/${fileId}.webp`;
}

const AVATAR_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/;

/** Si una ruta tiene la forma de un avatar (para servirla sin pedir cualquier cosa a Storage). */
export function isAvatarPath(path: string): boolean {
  return AVATAR_PATH.test(path);
}
