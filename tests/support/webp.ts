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

export function webp(options: WebpOptions = {}): Uint8Array {
  const data = chunkData(options);
  const padding = Math.max(0, (options.totalBytes ?? 0) - (20 + data.length));
  const body = [
    ...text("WEBP"),
    ...text(options.chunk ?? "VP8L"),
    ...le32(data.length + padding),
    ...data,
    ...new Array<number>(padding).fill(0),
  ];
  return Uint8Array.from([...text("RIFF"), ...le32(body.length), ...body]);
}

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
