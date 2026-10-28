// WebP mínimos para los tests: solo la cabecera que lee `inspectAvatar` (el
// contenedor RIFF y el primer chunk). No son imágenes que un navegador muestre.

type Chunk = "VP8L" | "VP8 " | "VP8X";

interface WebpOptions {
  readonly width?: number;
  readonly height?: number;
  readonly chunk?: Chunk;
  /** Banderas del chunk VP8X (animación, EXIF, XMP). */
  readonly flags?: number;
  /** Bytes de relleno hasta llegar a ese peso total. */
  readonly totalBytes?: number;
}

const text = (value: string) => [...new TextEncoder().encode(value)];
const le16 = (value: number) => [value & 0xff, (value >>> 8) & 0xff];
const le24 = (value: number) => [...le16(value), (value >>> 16) & 0xff];
const le32 = (value: number) => [...le16(value), ...le16(value >>> 16)];

function chunkData({
  width = 512,
  height = 512,
  chunk = "VP8L",
  flags = 0,
}: WebpOptions): number[] {
  if (chunk === "VP8L") {
    const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
    return [0x2f, ...le32(bits), 0, 0, 0, 0, 0];
  }
  if (chunk === "VP8 ") {
    // Cuadro clave (bit 0 en cero), código de inicio y el tamaño en 14 bits.
    return [0x10, 0x00, 0x00, 0x9d, 0x01, 0x2a, ...le16(width), ...le16(height)];
  }
  return [flags, 0, 0, 0, ...le24(width - 1), ...le24(height - 1)];
}

const chunkBytes = (fourCc: string, data: readonly number[]) => [
  ...text(fourCc),
  ...le32(data.length),
  ...data,
  ...(data.length % 2 === 1 ? [0] : []),
];

export function webp(options: WebpOptions = {}): Uint8Array {
  const chunk = options.chunk ?? "VP8L";
  const data = chunkData(options);
  // El VP8X va seguido de la imagen (un VP8L del mismo tamaño), como lo arma un navegador.
  const image =
    chunk === "VP8X" ? chunkBytes("VP8L", chunkData({ ...options, chunk: "VP8L" })) : [];
  const used = 20 + data.length + image.length;
  const padding = Math.max(0, (options.totalBytes ?? 0) - used);
  const body = [
    ...text("WEBP"),
    ...chunkBytes(chunk, [...data, ...new Array<number>(padding).fill(0)]),
    ...image,
  ];
  return Uint8Array.from([...text("RIFF"), ...le32(body.length), ...body]);
}

/** Un WebP armado a mano con los chunks tal cual (para probar tamaños falsificados). */
export function riff(chunks: readonly { fourCc: string; declaredSize: number; data: number[] }[]) {
  const body = [
    ...text("WEBP"),
    ...chunks.flatMap(({ fourCc, declaredSize, data }) => [
      ...text(fourCc),
      ...le32(declaredSize),
      ...data,
    ]),
  ];
  return Uint8Array.from([...text("RIFF"), ...le32(body.length), ...body]);
}

/** Los datos de un chunk de 512 × 512 (para armar casos con `riff`). */
export const chunkDataFor = (chunk: Chunk) => chunkData({ chunk });

// ── JPEG mínimos ─────────────────────────────────────────────────────────────

const be16 = (value: number) => [(value >>> 8) & 0xff, value & 0xff];
const segment = (marker: number, data: readonly number[]) => [
  0xff,
  marker,
  ...be16(data.length + 2),
  ...data,
];

/** APP0 JFIF: lo que escribe un `<canvas>`. */
const JFIF = segment(0xe0, [...text("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const startOfFrame = (width: number, height: number) =>
  segment(0xc0, [8, ...be16(height), ...be16(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
const startOfScan = segment(0xda, [3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0]);
/** Datos comprimidos de mentira, con un byte de relleno (`FF 00`) y un reinicio. */
const SCAN_DATA = [0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78];

interface JpegOptions {
  readonly width?: number;
  readonly height?: number;
  /** Segmentos antes del cuadro (por ejemplo, un APP1 con EXIF). */
  readonly before?: readonly number[];
  /** Algo entre dos barridos, como en un JPEG progresivo. */
  readonly betweenScans?: readonly number[];
  /** Bytes después del EOI (un polyglot). */
  readonly after?: readonly number[];
  /** Sin cuadro (SOF) o con dos. */
  readonly frames?: 0 | 1 | 2;
}

export function jpeg({
  width = 512,
  height = 512,
  before = [],
  betweenScans,
  after = [],
  frames = 1,
}: JpegOptions = {}): Uint8Array {
  const frame = startOfFrame(width, height);
  return Uint8Array.from([
    0xff,
    0xd8,
    ...JFIF,
    ...before,
    ...(frames >= 1 ? frame : []),
    ...(frames === 2 ? frame : []),
    ...startOfScan,
    ...SCAN_DATA,
    ...(betweenScans ? [...betweenScans, ...startOfScan, ...SCAN_DATA] : []),
    0xff,
    0xd9,
    ...after,
  ]);
}

/** Un APP1 con "Exif": datos de la cámara (y a veces la ubicación). */
export const EXIF_SEGMENT = segment(0xe1, [...text("Exif"), 0, 0, 1, 2, 3, 4]);
/** Un comentario de JPEG. */
export const COMMENT_SEGMENT = segment(0xfe, text("hola"));
/** Un perfil de color (APP2 ICC): permitido, no es un dato personal. */
export const ICC_SEGMENT = segment(0xe2, [...text("ICC_PROFILE"), 0, 1, 1]);

/** Un SVG con un script: lo que nunca tiene que llegar al bucket. */
export const SVG_WITH_SCRIPT = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);

/** La firma de un PNG (lo que tiene un PNG renombrado a .webp). */
export const PNG_SIGNATURE = Uint8Array.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  ...new Array<number>(40).fill(0),
]);
