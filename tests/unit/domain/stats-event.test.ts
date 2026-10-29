import { describe, expect, it } from "vitest";

import { normalizeCountry, parseStatsEvent } from "@/domain/stats-event";

const LINK = "0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";

describe("parseStatsEvent", () => {
  it("acepta una visita y un clic con su origen", () => {
    expect(parseStatsEvent({ t: "view", h: "JuedSay", s: "instagram" })).toEqual({
      type: "view",
      handle: "juedsay",
      source: "instagram",
    });
    expect(parseStatsEvent({ t: "click", l: LINK, s: "direct" })).toEqual({
      type: "click",
      linkId: LINK,
      source: "direct",
    });
  });

  it.each([
    [{ t: "view", h: "juedsay", s: "instagram", ua: "Mozilla" }],
    [{ t: "view", h: "juedsay", s: "https://evil.com" }],
    [{ t: "view", h: "../admin", s: "direct" }],
    [{ t: "click", l: "no-es-uuid", s: "direct" }],
    [{ t: "click", h: "juedsay", s: "direct" }],
    [{ t: "borrar", h: "juedsay", s: "direct" }],
    [null],
    ["view"],
  ])("rechaza %j", (raw) => {
    expect(parseStatsEvent(raw)).toBeNull();
  });
});

describe("normalizeCountry", () => {
  it("solo dos letras mayúsculas; lo demás es XX", () => {
    expect(normalizeCountry("AR")).toBe("AR");
    expect(normalizeCountry("ar")).toBe("XX");
    expect(normalizeCountry("<script>")).toBe("XX");
    expect(normalizeCountry(undefined)).toBe("XX");
  });
});
