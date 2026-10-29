import { describe, expect, it } from "vitest";

import type { StatsReader } from "@/application/ports/stats-reader";
import {
  buildStatsView,
  changeLabel,
  loadStatsView,
  parsePeriod,
  periodRange,
} from "@/application/stats/stats-view";

const NOW = new Date("2026-10-28T15:00:00Z");

describe("período", () => {
  it("solo 7, 30 o 90 días; cualquier otra cosa, 7", () => {
    expect(parsePeriod("30")).toBe(30);
    expect(parsePeriod("90")).toBe(90);
    expect(parsePeriod("365")).toBe(7);
    expect(parsePeriod("x")).toBe(7);
    expect(parsePeriod(null)).toBe(7);
  });

  it("termina hoy (UTC) y el anterior tiene la misma cantidad de días", () => {
    expect(periodRange(7, NOW)).toEqual({
      from: "2026-10-22",
      to: "2026-10-28",
      previousFrom: "2026-10-15",
      previousTo: "2026-10-21",
    });
  });
});

describe("buildStatsView", () => {
  const view = buildStatsView({
    period: 7,
    now: NOW,
    daily: [
      { day: "2026-10-16", views: 10, clicks: 1 },
      { day: "2026-10-23", views: 20, clicks: 4 },
      { day: "2026-10-28", views: 5, clicks: 1 },
    ],
    links: [
      { linkId: "a", title: "Twitch", clicks: 2 },
      { linkId: "b", title: "GitHub", clicks: 3 },
      { linkId: "c", title: "Sin clics", clicks: 0 },
    ],
    breakdown: [
      { dimension: "source", value: "direct", views: 15, clicks: 3 },
      { dimension: "source", value: "instagram", views: 10, clicks: 2 },
      ...Array.from({ length: 10 }, (_, index) => ({
        dimension: "country" as const,
        value: `C${String.fromCharCode(65 + index)}`,
        views: 10 - index,
        clicks: 0,
      })),
    ],
  });

  it("suma el período y el anterior por separado, con el porcentaje de clics", () => {
    expect(view.current).toEqual({ views: 25, clicks: 5, ctr: 0.2 });
    expect(view.previous).toEqual({ views: 10, clicks: 1, ctr: 0.1 });
    expect(view.empty).toBe(false);
  });

  it("un día por fila, con ceros donde no hubo nada", () => {
    expect(view.days).toHaveLength(7);
    expect(view.days[0]).toEqual({ day: "2026-10-22", views: 0, clicks: 0 });
    expect(view.days[1]).toEqual({ day: "2026-10-23", views: 20, clicks: 4 });
    expect(view.days.at(-1)).toEqual({ day: "2026-10-28", views: 5, clicks: 1 });
  });

  it("links por clics (sin los que no tuvieron), con su porcentaje sobre las visitas", () => {
    expect(view.links).toEqual([
      { linkId: "b", title: "GitHub", clicks: 3, ctr: 0.12 },
      { linkId: "a", title: "Twitch", clicks: 2, ctr: 0.08 },
    ]);
  });

  it("los 8 países principales y el resto en 'otros'; orígenes en orden fijo", () => {
    expect(view.countries.map((row) => row.value)).toEqual([
      "CA",
      "CB",
      "CC",
      "CD",
      "CE",
      "CF",
      "CG",
      "CH",
      "otros",
    ]);
    expect(view.countries.at(-1)).toMatchObject({ views: 3 });
    expect(view.sources.map((row) => row.value)).toEqual(["instagram", "direct"]);
  });

  it("sin datos queda vacío, sin porcentaje", () => {
    const empty = buildStatsView({ period: 30, now: NOW, daily: [], links: [], breakdown: [] });
    expect(empty.empty).toBe(true);
    expect(empty.current.ctr).toBeNull();
    expect(empty.days).toHaveLength(30);
  });
});

describe("loadStatsView", () => {
  it("lee el período con el anterior, y links y orígenes solo del período", async () => {
    const asked: string[] = [];
    const reader: StatsReader = {
      daily: (_page, from, to) => {
        asked.push(`daily ${from} ${to}`);
        return Promise.resolve([]);
      },
      linkClicks: (_page, from, to) => {
        asked.push(`links ${from} ${to}`);
        return Promise.resolve([]);
      },
      breakdown: (_page, from, to) => {
        asked.push(`breakdown ${from} ${to}`);
        return Promise.resolve([]);
      },
    };
    await loadStatsView(reader, "pagina", 7, NOW);
    expect(asked).toEqual([
      "daily 2026-10-15 2026-10-28",
      "links 2026-10-22 2026-10-28",
      "breakdown 2026-10-22 2026-10-28",
    ]);
  });
});

describe("changeLabel", () => {
  it.each([
    [12, 10, "+20 %"],
    [5, 10, "−50 %"],
    [10, 10, "igual"],
    [3, 0, "nuevo"],
    [0, 0, "igual"],
    [1001, 1000, "igual"],
  ])("%i contra %i → %s", (current, previous, label) => {
    expect(changeLabel(current, previous)).toBe(label);
  });
});
