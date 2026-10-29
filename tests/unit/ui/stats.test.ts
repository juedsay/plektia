import { describe, expect, it } from "vitest";

import { count, countryName, percent, shortDay, sourceName } from "@/ui/view/stats";

describe("estadísticas · presentación", () => {
  it("nombra orígenes y países", () => {
    expect(sourceName("direct")).toBe("Directo");
    expect(sourceName("x")).toBe("X");
    expect(countryName("AR")).toBe("Argentina");
    expect(countryName("XX")).toBe("Sin dato");
    expect(countryName("otros")).toBe("Otros países");
    expect(countryName("<b>")).toBe("Sin dato");
  });

  it("porcentajes, cantidades y días a la manera argentina", () => {
    expect(percent(0.1234)).toBe("12,3 %");
    expect(percent(null)).toBe("—");
    expect(count(12345)).toBe("12.345");
    expect(shortDay("2026-10-28")).toMatch(/^28 oct/);
  });
});
