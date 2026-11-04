import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { styleHash } from "@/ui/styles/themes/inline";

describe("styleHash: el hash de un estilo en línea para la CSP", () => {
  it("es el sha256 en base64 del texto exacto", () => {
    const css = ".port{color:red}é";
    const expected = createHash("sha256").update(css, "utf8").digest("base64");
    expect(styleHash(css)).toBe(`sha256-${expected}`);
  });

  it("un cambio mínimo cambia el hash", () => {
    expect(styleHash("a{}")).not.toBe(styleHash("a{ }"));
  });
});
