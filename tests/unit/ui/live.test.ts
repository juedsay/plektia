import { describe, expect, it } from "vitest";

import { liveElapsed } from "@/ui/view/live";

describe("liveElapsed", () => {
  const start = "2026-10-28T10:00:00Z";
  it.each([
    [Date.parse("2026-10-28T11:24:05Z"), "1:24:05"],
    [Date.parse("2026-10-28T10:00:59Z"), "0:00:59"],
    [Date.parse("2026-10-29T12:00:00Z"), "26:00:00"],
    // Con el reloj del visitante atrasado, nunca un tiempo negativo.
    [Date.parse("2026-10-28T09:59:00Z"), "0:00:00"],
  ])("%s → %s", (now, expected) => {
    expect(liveElapsed(start, now)).toBe(expected);
  });
});
