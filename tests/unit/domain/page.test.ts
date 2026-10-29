import { describe, expect, it } from "vitest";

import { BIO_MAX_LENGTH, parsePageSettings } from "@/domain/page";

const valid = {
  displayName: "Julián",
  bio: "QA",
  theme: "tecnico",
  colorMode: "light",
  showHandle: true,
};

describe("parsePageSettings", () => {
  it("valida y recorta los textos", () => {
    expect(parsePageSettings({ ...valid, displayName: "  Julián ", bio: " QA " })).toEqual({
      ok: true,
      value: valid,
    });
  });

  it("sin modo, queda en automático", () => {
    const withoutMode = { displayName: "Julián", bio: "QA", theme: "tecnico", showHandle: true };
    expect(parsePageSettings(withoutMode)).toMatchObject({
      ok: true,
      value: { colorMode: "auto" },
    });
  });

  it("una bio vacía queda en null", () => {
    expect(parsePageSettings({ ...valid, bio: "   " })).toMatchObject({
      ok: true,
      value: { bio: null },
    });
  });

  it.each([
    [{ displayName: "" }, "displayName"],
    [{ bio: "x".repeat(BIO_MAX_LENGTH + 1) }, "bio"],
    [{ bio: "con\u202einvisible" }, "bio"],
    [{ theme: "cercano" }, "theme"],
    [{ showHandle: "sí" }, "showHandle"],
    [{ colorMode: "sepia" }, "colorMode"],
  ])("rechaza %o en su campo", (change, field) => {
    const result = parsePageSettings({ ...valid, ...change });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.error.fields)).toEqual([field]);
  });

  it("acepta una bio de exactamente el máximo", () => {
    expect(parsePageSettings({ ...valid, bio: "x".repeat(BIO_MAX_LENGTH) }).ok).toBe(true);
  });
});
