import { err, ok, type Result } from "@/domain/result";

// Avatar de una página (SPEC-admin-panel, "Avatar"). El navegador lo recorta y lo
// re-codifica a WebP de 512 × 512 (o a JPEG si no sabe generar WebP, como
// Safari); acá se vuelve a validar con los bytes, sin creerle al nombre ni al
// tipo que manda el navegador: un SVG o un PNG renombrado no tienen la
// estructura de un WebP ni de un JPEG.

/** Lado del avatar, en píxeles. */
export const AVATAR_SIZE = 512;
/** Peso máximo de la imagen ya re-codificada (el bucket aplica el mismo límite). */
export const AVATAR_MAX_BYTES = 200 * 1024;

export type AvatarFormat = "webp" | "jpeg";

export type AvatarError =
  "too_large" | "not_an_image" | "wrong_dimensions" | "animated" | "has_metadata";

const MESSAGES: Readonly<Record<AvatarError, string>> = {
  too_large: "La imagen pesa demasiado. Probá con otra o recortala de nuevo.",
  not_an_image: "No pudimos leer la imagen. Probá con un JPEG, PNG o WebP.",
  wrong_dimensions: "La imagen tiene que ser cuadrada, de 512 × 512.",
  animated: "Por ahora el avatar no puede ser animado.",
  has_metadata: "La imagen trae datos de la cámara o la ubicación: recortala de nuevo.",
};

export function avatarErrorMessage(error: AvatarError): string {
  return MESSAGES[error];
}

export interface InspectedAvatar {
  readonly format: AvatarFormat;
  readonly width: number;
  readonly height: number;
}

type Dimensions = Pick<InspectedAvatar, "width" | "height">;

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

// WebP es little-endian; JPEG, big-endian.
const uint16 = (bytes: Uint8Array, at: number) => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
const uint24 = (bytes: Uint8Array, at: number) => uint16(bytes, at) | ((bytes[at + 2] ?? 0) << 16);
const uint32 = (bytes: Uint8Array, at: number) =>
  (uint24(bytes, at) | ((bytes[at + 3] ?? 0) << 24)) >>> 0;
const bigEndian16 = (bytes: Uint8Array, at: number) =>
  ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);

// ── WebP ────────────────────────────────────────────────────────────────────

// Banderas del chunk VP8X (especificación del contenedor WebP).
const VP8X_ANIMATION = 0x02;
const VP8X_XMP = 0x04;
const VP8X_EXIF = 0x08;

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
function readWebpImage(bytes: Uint8Array, chunk: Chunk): Result<Dimensions, AvatarError> {
  const data = chunk.start;
  if (chunk.fourCc === "VP8 " && chunk.size >= VP8_HEADER_BYTES) {
    // Cuadro clave con su código de inicio; el tamaño son 14 bits.
    const keyFrame = ((bytes[data] ?? 1) & 0x01) === 0;
    const startCode =
      bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a;
    if (!keyFrame || !startCode) return err("not_an_image");
    return ok({
      width: uint16(bytes, data + 6) & 0x3fff,
      height: uint16(bytes, data + 8) & 0x3fff,
    });
  }
  if (chunk.fourCc === "VP8L" && chunk.size >= VP8L_HEADER_BYTES) {
    if (bytes[data] !== 0x2f) return err("not_an_image");
    const bits = uint32(bytes, data + 1);
    return ok({ width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 });
  }
  return err("not_an_image");
}

const isWebp = (bytes: Uint8Array) =>
  bytes.length >= 20 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";

/** Ancho y alto de un WebP, o el motivo por el que no es válido. */
function readWebp(bytes: Uint8Array): Result<Dimensions, AvatarError> {
  // El tamaño declarado tiene que ser el real: nada escondido después del WebP.
  if (uint32(bytes, 4) !== bytes.length - 8) return err("not_an_image");

  const chunks = readChunks(bytes);
  const [first] = chunks ?? [];
  if (!first) return err("not_an_image");
  if (first.fourCc !== "VP8X") return readWebpImage(bytes, first);

  // Formato extendido: banderas y lienzo, y después la imagen, del mismo tamaño.
  if (first.size !== VP8X_BYTES) return err("not_an_image");
  const flags = bytes[first.start] ?? 0;
  if (flags & VP8X_ANIMATION) return err("animated");
  if (flags & (VP8X_EXIF | VP8X_XMP)) return err("has_metadata");
  const canvas = {
    width: uint24(bytes, first.start + 4) + 1,
    height: uint24(bytes, first.start + 7) + 1,
  };
  const imageChunk = chunks?.find((chunk) => chunk.fourCc === "VP8 " || chunk.fourCc === "VP8L");
  if (!imageChunk) return err("not_an_image");
  const image = readWebpImage(bytes, imageChunk);
  if (!image.ok) return image;
  if (image.value.width !== canvas.width || image.value.height !== canvas.height) {
    return err("not_an_image");
  }
  return ok(canvas);
}

// ── JPEG ────────────────────────────────────────────────────────────────────

const MARKER = 0xff;
const START_OF_IMAGE = 0xd8;
const END_OF_IMAGE = 0xd9;
const START_OF_SCAN = 0xda;
// Segmentos con datos de la cámara, la ubicación o texto: APP1 (EXIF y XMP),
// APP13 (IPTC de Photoshop) y comentarios. Un `<canvas>` nunca los escribe.
const METADATA_MARKERS = new Set([0xe1, 0xed, 0xfe]);

/** Marcadores sin datos: reinicios (dentro de los datos comprimidos) y TEM. */
const isStandalone = (marker: number) => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);

/** Comienzo de cuadro (SOF): define el tamaño. C4, C8 y CC son otras cosas. */
const isStartOfFrame = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

const isJpeg = (bytes: Uint8Array) => bytes[0] === MARKER && bytes[1] === START_OF_IMAGE;

/**
 * Después de un SOS vienen los datos comprimidos: termina en el próximo marcador
 * que no sea un byte de relleno (`FF 00`) ni un reinicio. Devuelve dónde.
 */
function skipScanData(bytes: Uint8Array, from: number): number {
  let offset = from;
  while (offset + 1 < bytes.length) {
    const next = bytes[offset + 1] ?? 0;
    if (bytes[offset] === MARKER && next !== 0x00 && next !== MARKER && !isStandalone(next)) {
      return offset;
    }
    offset += 1;
  }
  return bytes.length;
}

/**
 * Ancho y alto de un JPEG recorriendo todos sus segmentos: un solo cuadro, al
 * menos un barrido con la imagen (después del cuadro), sin metadatos (tampoco
 * entre barridos de un JPEG progresivo) y terminado justo en el EOI, sin nada
 * escondido después.
 */
function readJpeg(bytes: Uint8Array): Result<Dimensions, AvatarError> {
  let frame: Dimensions | null = null;
  let scanned = false;
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== MARKER) return err("not_an_image");
    const marker = bytes[offset + 1] ?? 0;
    if (marker === MARKER) {
      offset += 1; // Relleno entre segmentos.
      continue;
    }
    if (marker === END_OF_IMAGE) {
      // Sin barrido no hay imagen que mostrar, aunque el cuadro diga 512 × 512.
      const atEnd = offset + 2 === bytes.length;
      return frame && scanned && atEnd ? ok(frame) : err("not_an_image");
    }
    if (isStandalone(marker)) {
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) return err("not_an_image");
    const length = bigEndian16(bytes, offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) return err("not_an_image");
    if (METADATA_MARKERS.has(marker)) return err("has_metadata");
    if (isStartOfFrame(marker)) {
      // Precisión (1 byte), alto y ancho (2 cada uno).
      if (frame || length < 7) return err("not_an_image");
      frame = { height: bigEndian16(bytes, offset + 5), width: bigEndian16(bytes, offset + 7) };
    }
    if (marker === START_OF_SCAN) {
      if (!frame) return err("not_an_image");
      scanned = true;
      offset = skipScanData(bytes, end);
      continue;
    }
    offset = end;
  }
  return err("not_an_image");
}

// ── Validación ──────────────────────────────────────────────────────────────

/**
 * Valida una imagen ya re-codificada en el navegador: peso, WebP o JPEG de verdad
 * (por su estructura), quieta, sin metadatos, sin bytes de más y del tamaño
 * exacto. La usan el avatar y la vista previa de un artículo (SPEC-link-form).
 */
export function inspectStillImage(
  bytes: Uint8Array,
  expected: { readonly width: number; readonly height: number; readonly maxBytes: number },
): Result<InspectedAvatar, AvatarError> {
  if (bytes.length > expected.maxBytes) return err("too_large");
  const format: AvatarFormat | null = isWebp(bytes) ? "webp" : isJpeg(bytes) ? "jpeg" : null;
  if (!format) return err("not_an_image");
  const read = format === "webp" ? readWebp(bytes) : readJpeg(bytes);
  if (!read.ok) return read;
  if (read.value.width !== expected.width || read.value.height !== expected.height) {
    return err("wrong_dimensions");
  }
  return ok({ format, ...read.value });
}

/** Valida un avatar: una imagen quieta de 512 × 512 y hasta 200 KB. */
export function inspectAvatar(bytes: Uint8Array): Result<InspectedAvatar, AvatarError> {
  return inspectStillImage(bytes, {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    maxBytes: AVATAR_MAX_BYTES,
  });
}

// ── Rutas y tipos ───────────────────────────────────────────────────────────

const EXTENSIONS: Readonly<Record<AvatarFormat, string>> = { webp: "webp", jpeg: "jpg" };
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  webp: "image/webp",
  jpg: "image/jpeg",
};

/** Ruta de un avatar en el bucket: la carpeta de su dueño y un nombre nuevo cada vez. */
export function avatarPath(ownerId: string, fileId: string, format: AvatarFormat): string {
  return `${ownerId}/${fileId}.${EXTENSIONS[format]}`;
}

const AVATAR_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg)$/;

/** Si una ruta tiene la forma de un avatar (para servirla sin pedir cualquier cosa a Storage). */
export function isAvatarPath(path: string): boolean {
  return AVATAR_PATH.test(path);
}

/** El tipo con el que se sube y se sirve un avatar, según su ruta (`null` si no es una). */
export function avatarContentType(path: string): string | null {
  const extension = AVATAR_PATH.exec(path)?.[1];
  return extension ? (CONTENT_TYPES[extension] ?? null) : null;
}
