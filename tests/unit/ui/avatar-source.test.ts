import { describe, expect, it } from "vitest";

import {
  checkSource,
  cropSquare,
  initialCrop,
  MAX_ZOOM,
  moveCrop,
  SOURCE_MAX_BYTES,
  sniffSourceType,
  sourceErrorMessage,
  zoomCrop,
} from "@/ui/view/avatar-source";

import {
  EXIF_SEGMENT,
  jpeg,
  PNG_SIGNATURE,
  pngHeader,
  SVG_WITH_SCRIPT,
  webp,
} from "../../support/webp";

describe("la foto elegida: tipo real por sus bytes", () => {
  it("reconoce PNG, JPEG y WebP", () => {
    expect(sniffSourceType(pngHeader(800, 600))).toBe("png");
    expect(sniffSourceType(jpeg())).toBe("jpeg");
    expect(sniffSourceType(webp())).toBe("webp");
  });

  it("un SVG (aunque se llame .png) no es una foto", () => {
    expect(sniffSourceType(SVG_WITH_SCRIPT)).toBeNull();
    expect(checkSource(SVG_WITH_SCRIPT.length, SVG_WITH_SCRIPT)).toEqual({
      ok: false,
      error: "not_an_image",
    });
  });
});

describe("checkSource: antes de decodificar", () => {
  it("acepta fotos comunes, también con EXIF (el recorte se lo borra)", () => {
    expect(checkSource(1000, pngHeader(1200, 900))).toMatchObject({
      ok: true,
      type: "png",
      dimensions: { width: 1200, height: 900 },
    });
    expect(
      checkSource(1000, jpeg({ width: 3000, height: 4000, before: EXIF_SEGMENT })),
    ).toMatchObject({
      ok: true,
      type: "jpeg",
      dimensions: { width: 3000, height: 4000 },
    });
    expect(checkSource(1000, webp({ chunk: "VP8X", width: 2000, height: 2000 }))).toMatchObject({
      ok: true,
      type: "webp",
    });
    expect(checkSource(1000, webp({ chunk: "VP8 ", width: 640, height: 640 })).ok).toBe(true);
  });

  it("más de 5 MB se rechaza sin mirar el contenido", () => {
    expect(checkSource(SOURCE_MAX_BYTES + 1, pngHeader(800, 600))).toEqual({
      ok: false,
      error: "too_heavy",
    });
  });

  it("una 'bomba' de píxeles se rechaza leyendo solo la cabecera", () => {
    expect(checkSource(1000, pngHeader(20000, 20000))).toEqual({ ok: false, error: "too_big" });
    expect(checkSource(1000, pngHeader(8000, 6000))).toEqual({ ok: false, error: "too_big" });
    expect(checkSource(1000, jpeg({ width: 9000, height: 100 }))).toEqual({
      ok: false,
      error: "too_big",
    });
  });

  it("muy chica, o sin tamaño legible, se rechaza", () => {
    expect(checkSource(1000, pngHeader(64, 64))).toEqual({ ok: false, error: "too_small" });
    expect(checkSource(1000, pngHeader(0, 600))).toEqual({ ok: false, error: "not_an_image" });
    expect(checkSource(1000, PNG_SIGNATURE)).toEqual({ ok: false, error: "not_an_image" });
    expect(checkSource(1000, jpeg({ frames: 0 }))).toEqual({ ok: false, error: "not_an_image" });
    expect(
      checkSource(1000, Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0, 0, 0, 0, 0, 0])),
    ).toEqual({
      ok: false,
      error: "not_an_image",
    });
  });

  it("cada error tiene su mensaje", () => {
    for (const error of ["too_heavy", "not_an_image", "too_big", "too_small"] as const) {
      expect(sourceErrorMessage(error).length).toBeGreaterThan(10);
    }
  });
});

describe("recorte", () => {
  const landscape = { width: 1200, height: 800 };

  it("arranca centrado, con el cuadrado más grande que entra", () => {
    expect(cropSquare(landscape, initialCrop(landscape))).toEqual({ x: 200, y: 0, size: 800 });
  });

  it("el zoom achica el cuadrado alrededor del centro, entre 1× y 4×", () => {
    const zoomed = zoomCrop(landscape, initialCrop(landscape), 2);
    expect(cropSquare(landscape, zoomed)).toEqual({ x: 400, y: 200, size: 400 });
    const tooMuch = zoomCrop(landscape, initialCrop(landscape), 99);
    expect(tooMuch.zoom).toBe(MAX_ZOOM);
    expect(zoomCrop(landscape, initialCrop(landscape), 0.1).zoom).toBe(1);
  });

  it("moverlo nunca lo saca de la imagen", () => {
    const start = initialCrop(landscape);
    expect(cropSquare(landscape, moveCrop(landscape, start, -5000, 0))).toEqual({
      x: 0,
      y: 0,
      size: 800,
    });
    expect(cropSquare(landscape, moveCrop(landscape, start, 5000, 5000))).toEqual({
      x: 400,
      y: 0,
      size: 800,
    });
    const zoomed = zoomCrop(landscape, start, 2);
    expect(cropSquare(landscape, moveCrop(landscape, zoomed, 50, -50))).toEqual({
      x: 450,
      y: 150,
      size: 400,
    });
  });

  it("alejar el zoom cerca de un borde corre el centro para no salirse", () => {
    const nearCorner = moveCrop(
      landscape,
      zoomCrop(landscape, initialCrop(landscape), 4),
      -5000,
      -5000,
    );
    expect(cropSquare(landscape, zoomCrop(landscape, nearCorner, 1))).toEqual({
      x: 0,
      y: 0,
      size: 800,
    });
  });
});
