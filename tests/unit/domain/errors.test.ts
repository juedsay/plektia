import { describe, expect, it } from "vitest";

import { DOMAIN_ERRORS, errorMessage, invalidInput } from "@/domain/errors";

describe("mensajes de error", () => {
  it("cada error tiene su mensaje en español", () => {
    for (const error of DOMAIN_ERRORS) {
      expect(errorMessage(error)).toMatch(/^[A-ZÁÉÍÓÚÑ¡¿].+\.$/);
    }
  });

  it("el conflicto explica qué hacer", () => {
    expect(errorMessage("conflict")).toContain("Recargá");
  });

  it("invalidInput arma el error con los campos", () => {
    expect(invalidInput({ title: "x" })).toEqual({ kind: "invalid_input", fields: { title: "x" } });
  });
});
