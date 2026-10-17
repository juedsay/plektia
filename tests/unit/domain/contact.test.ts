import { describe, expect, it } from "vitest";

import { CONTACT_LIMITS, looksLikeBot, parseContactInput } from "@/domain/contact";

const valid = { name: "Ana", email: "ana@example.com", message: "Hola,\r\nquiero una invitación." };

describe("parseContactInput", () => {
  it("acepta un mensaje válido y normaliza los saltos de línea", () => {
    expect(parseContactInput(valid)).toEqual({
      ok: true,
      value: { name: "Ana", email: "ana@example.com", message: "Hola,\nquiero una invitación." },
    });
  });

  it.each([
    [{ ...valid, name: "" }, "name"],
    [{ ...valid, name: "a".repeat(CONTACT_LIMITS.name + 1) }, "name"],
    [{ ...valid, name: "Ana\nBot" }, "name"],
    [{ ...valid, email: "no-es-un-email" }, "email"],
    [{ ...valid, email: `${"a".repeat(250)}@x.co` }, "email"],
    [{ ...valid, message: "   " }, "message"],
    [{ ...valid, message: "a".repeat(CONTACT_LIMITS.message + 1) }, "message"],
    [{ ...valid, message: "texto\u202Eoculto" }, "message"],
    [{ ...valid, message: "nulo\u0000" }, "message"],
    [{ ...valid, message: "invisible\u200B" }, "message"],
  ])("rechaza %j en el campo %s", (raw, field) => {
    const result = parseContactInput(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.error.fields)).toContain(field);
  });

  it("sin datos devuelve un error de formulario", () => {
    expect(parseContactInput(null).ok).toBe(false);
  });
});

describe("looksLikeBot", () => {
  it("una persona deja vacío el campo trampa", () => {
    expect(looksLikeBot({ ...valid, website: "" })).toBe(false);
    expect(looksLikeBot(valid)).toBe(false);
  });

  it("un bot lo completa", () => {
    expect(looksLikeBot({ ...valid, website: "https://spam.test" })).toBe(true);
  });
});
