import { encode } from "uqr";

// Código QR de una página (para flyers, stickers o una pantalla en un stream).
// Siempre negro sobre blanco y con el margen que pide el estándar (4 módulos):
// es lo que mejor escanea cualquier cámara, sea cual sea el estilo de la página.
// Corrección "M" (hasta 15 % dañado): aguanta un sticker gastado sin agrandarlo.

/** Margen alrededor del código, en módulos (el estándar pide 4). */
const QUIET_ZONE = 4;

/**
 * El SVG del código QR de `text` (una URL de Plektia). Cada fila oscura se
 * dibuja como tramos horizontales en un solo `path`: liviano y sin huecos entre
 * módulos al escalarlo.
 */
export function qrCodeSvg(text: string, title: string): string {
  const { data, size } = encode(text, { ecc: "M", border: QUIET_ZONE });
  let path = "";
  for (const [row, cells] of data.entries()) {
    let start = -1;
    for (let column = 0; column <= size; column++) {
      const dark = column < size && cells[column] === true;
      if (dark && start === -1) start = column;
      if (!dark && start !== -1) {
        path += `M${String(start)} ${String(row)}h${String(column - start)}v1h-${String(column - start)}z`;
        start = -1;
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(size)} ${String(size)}" ` +
    `shape-rendering="crispEdges" role="img"><title>${escapeXml(title)}</title>` +
    `<rect width="${String(size)}" height="${String(size)}" fill="#fff"/>` +
    `<path fill="#000" d="${path}"/></svg>`
  );
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
