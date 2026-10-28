import { describe, expect, it } from "vitest";

import {
  AVATAR_MAX_BYTES,
  avatarErrorMessage,
  avatarPath,
  inspectAvatar,
  isAvatarPath,
} from "@/domain/avatar";

import { chunkDataFor, PNG_SIGNATURE, riff, SVG_WITH_SCRIPT, webp } from "../../support/webp";

describe("inspectAvatar", () => {
  it.each(["VP8L", "VP8 ", "VP8X"] as const)("acepta un WebP %s de 512 × 512", (chunk) => {
    expect(inspectAvatar(webp({ chunk }))).toEqual({
      ok: true,
      value: { width: 512, height: 512 },
    });
  });

  it.each([
    ["un SVG con un script", SVG_WITH_SCRIPT],
    ["un PNG renombrado", PNG_SIGNATURE],
    ["un archivo vacío", new Uint8Array()],
  ])("rechaza %s: no es un WebP", (_caso, bytes) => {
    expect(inspectAvatar(bytes)).toEqual({ ok: false, error: "not_webp" });
  });

  it("rechaza lo que pesa más de 200 KB, antes de mirar el contenido", () => {
    expect(inspectAvatar(webp({ totalBytes: AVATAR_MAX_BYTES + 1 }))).toEqual({
      ok: false,
      error: "too_large",
    });
    expect(inspectAvatar(new Uint8Array(10 * 1024 * 1024))).toEqual({
      ok: false,
      error: "too_large",
    });
  });

  it.each([
    [4000, 4000],
    [512, 400],
    [256, 256],
  ])("rechaza %i × %i: tiene que ser 512 × 512", (width, height) => {
    expect(inspectAvatar(webp({ width, height }))).toEqual({
      ok: false,
      error: "wrong_dimensions",
    });
  });

  it("rechaza un WebP animado o con EXIF/XMP", () => {
    expect(inspectAvatar(webp({ chunk: "VP8X", flags: 0x02 }))).toEqual({
      ok: false,
      error: "animated",
    });
    expect(inspectAvatar(webp({ chunk: "VP8X", flags: 0x08 }))).toEqual({
      ok: false,
      error: "has_metadata",
    });
    expect(inspectAvatar(webp({ chunk: "VP8X", flags: 0x04 }))).toEqual({
      ok: false,
      error: "has_metadata",
    });
  });

  it("rechaza bytes escondidos después del WebP (polyglot)", () => {
    const valid = webp();
    const withTail = Uint8Array.from([...valid, ...SVG_WITH_SCRIPT]);
    expect(inspectAvatar(withTail)).toEqual({ ok: false, error: "not_webp" });
  });

  it("rechaza un VP8 que no es cuadro clave o sin código de inicio, y un VP8L sin firma", () => {
    const lossy = webp({ chunk: "VP8 " });
    const notKeyFrame = Uint8Array.from(lossy);
    notKeyFrame[20] = 0x11;
    expect(inspectAvatar(notKeyFrame)).toEqual({ ok: false, error: "not_webp" });
    const noStartCode = Uint8Array.from(lossy);
    noStartCode[23] = 0x00;
    expect(inspectAvatar(noStartCode)).toEqual({ ok: false, error: "not_webp" });
    const lossless = Uint8Array.from(webp());
    lossless[20] = 0x00;
    expect(inspectAvatar(lossless)).toEqual({ ok: false, error: "not_webp" });
  });

  it.each([
    ["en cero", 0],
    ["más corto que la cabecera de la imagen", 3],
    ["más largo que el archivo", 5000],
  ])("rechaza un chunk con el tamaño %s (cabecera falsificada)", (_caso, declaredSize) => {
    const forged = riff([{ fourCc: "VP8L", declaredSize, data: chunkDataFor("VP8L") }]);
    expect(inspectAvatar(forged)).toEqual({ ok: false, error: "not_webp" });
  });

  it("rechaza un VP8X sin la imagen, o con una imagen de otro tamaño", () => {
    expect(
      inspectAvatar(riff([{ fourCc: "VP8X", declaredSize: 10, data: chunkDataFor("VP8X") }])),
    ).toEqual({
      ok: false,
      error: "not_webp",
    });
    const mismatched = riff([
      { fourCc: "VP8X", declaredSize: 10, data: chunkDataFor("VP8X") },
      {
        fourCc: "VP8L",
        declaredSize: 10,
        data: [...webp({ width: 256, height: 256 }).subarray(20, 30)],
      },
    ]);
    expect(inspectAvatar(mismatched)).toEqual({ ok: false, error: "not_webp" });
  });

  it("rechaza un chunk desconocido", () => {
    const unknown = Uint8Array.from(webp());
    unknown.set([...new TextEncoder().encode("ALPH")], 12);
    expect(inspectAvatar(unknown)).toEqual({ ok: false, error: "not_webp" });
  });

  it("cada error tiene un mensaje para el panel", () => {
    for (const error of [
      "too_large",
      "not_webp",
      "wrong_dimensions",
      "animated",
      "has_metadata",
    ] as const) {
      expect(avatarErrorMessage(error).length).toBeGreaterThan(10);
    }
  });
});

describe("rutas de avatar", () => {
  const owner = "22222222-2222-4222-8222-222222222222";
  const file = "0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";

  it("la carpeta del dueño y un nombre nuevo", () => {
    expect(avatarPath(owner, file)).toBe(`${owner}/${file}.webp`);
    expect(isAvatarPath(avatarPath(owner, file))).toBe(true);
  });

  it.each([
    "../secreto",
    `${owner}/../${file}.webp`,
    `${owner}/${file}.svg`,
    `${owner}/sub/${file}.webp`,
    "https://evil.test/x.webp",
  ])("no es una ruta de avatar: %s", (path) => {
    expect(isAvatarPath(path)).toBe(false);
  });
});
