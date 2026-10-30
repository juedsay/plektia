import { describe, expect, it } from "vitest";

import {
  isPreviewImagePath,
  previewImageContentType,
  previewImagePath,
  sniffImageType,
} from "@/domain/link-preview-image";

import { jpeg, PNG_SIGNATURE, SVG_WITH_SCRIPT, webp } from "../../support/webp";

const OWNER = "22222222-2222-4222-8222-222222222222";
const FILE = "0b1d2c3e-4f5a-4b6c-8d7e-000000000001";

describe("rutas de la imagen de la vista previa", () => {
  it("van a la carpeta del dueño, con la extensión de su formato", () => {
    expect(previewImagePath(OWNER, FILE, "webp")).toBe(`${OWNER}/${FILE}.webp`);
    expect(previewImageContentType(`${OWNER}/${FILE}.jpg`)).toBe("image/jpeg");
  });

  it.each([`../${FILE}.webp`, `${OWNER}/${FILE}.svg`, `${OWNER}/x/${FILE}.webp`, "nada"])(
    "%s no es una ruta válida",
    (path) => {
      expect(isPreviewImagePath(path)).toBe(false);
      expect(previewImageContentType(path)).toBeNull();
    },
  );
});

describe("sniffImageType", () => {
  it("reconoce JPEG, PNG, WebP y GIF por sus bytes", () => {
    expect(sniffImageType(jpeg())).toBe("image/jpeg");
    expect(sniffImageType(PNG_SIGNATURE)).toBe("image/png");
    expect(sniffImageType(webp())).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
  });

  it("un SVG o un HTML no son una imagen, digan lo que digan", () => {
    expect(sniffImageType(SVG_WITH_SCRIPT)).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<html>"))).toBeNull();
  });
});
