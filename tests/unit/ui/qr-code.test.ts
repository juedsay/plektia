import { describe, expect, it } from "vitest";
import { encode } from "uqr";

import { qrCodeSvg } from "@/ui/view/qr-code";

const URL_PAGINA = "https://app.plektia.workers.dev/juedsay";

/** Vuelve a armar la grilla de módulos desde el `path` del SVG. */
function modulesOf(svg: string, size: number): boolean[][] {
  const grid = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const d = /<path fill="#000" d="([^"]*)"/.exec(svg)?.[1] ?? "";
  for (const [, x, y, width] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let column = Number(x); column < Number(x) + Number(width); column++) {
      const row = grid[Number(y)];
      if (row) row[column] = true;
    }
  }
  return grid;
}

describe("qrCodeSvg", () => {
  it("dibuja exactamente los módulos del código, con margen de 4", () => {
    const expected = encode(URL_PAGINA, { ecc: "M", border: 4 });
    const svg = qrCodeSvg(URL_PAGINA, "QR");
    expect(svg).toContain(`viewBox="0 0 ${String(expected.size)} ${String(expected.size)}"`);
    expect(modulesOf(svg, expected.size)).toEqual(expected.data);
    // El margen (4 módulos) queda blanco.
    expect(expected.data[0]?.some(Boolean)).toBe(false);
  });

  it("negro sobre blanco, sin scripts ni recursos de afuera", () => {
    const svg = qrCodeSvg(URL_PAGINA, "QR");
    expect(svg).toContain('fill="#fff"');
    expect(svg).toContain('fill="#000"');
    expect(svg).not.toMatch(/<script|href=|on[a-z]+=/i);
  });

  it("escapa el título", () => {
    const svg = qrCodeSvg(URL_PAGINA, `Código <de> "Ana" & 'Leo'`);
    expect(svg).toContain("<title>Código &lt;de&gt; &quot;Ana&quot; &amp; &apos;Leo&apos;</title>");
  });
});
