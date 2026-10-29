import type {
  BreakdownRow,
  DailyRow,
  LinkClicksRow,
  StatsReader,
} from "@/application/ports/stats-reader";
import { TRAFFIC_SOURCES, type TrafficSource } from "@/domain/traffic-source";

// La vista de estadísticas de una página (SPEC-click-analytics, historia 3):
// el período elegido comparado con el anterior, los clics por link, países,
// orígenes y la evolución diaria. Funciones puras salvo `loadStatsView`.

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

/** `?dias=30` → 30; cualquier otra cosa, el predeterminado (7). */
export function parsePeriod(raw: string | null): Period {
  const days = Number(raw);
  return (PERIODS as readonly number[]).includes(days) ? (days as Period) : 7;
}

export interface Totals {
  readonly views: number;
  readonly clicks: number;
  /** Clics sobre visitas (0 a 1); `null` sin visitas. */
  readonly ctr: number | null;
}

export interface StatsView {
  readonly period: Period;
  readonly from: string;
  readonly to: string;
  readonly current: Totals;
  readonly previous: Totals;
  /** Un día por fila, del más viejo al más nuevo, con ceros donde no hubo nada. */
  readonly days: readonly DailyRow[];
  /** Ordenados por clics, de más a menos; el CTR es sobre las visitas de la página. */
  readonly links: readonly (LinkClicksRow & { readonly ctr: number | null })[];
  readonly countries: readonly BreakdownRow[];
  readonly sources: readonly BreakdownRow[];
  readonly empty: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Cuántos países se listan; el resto se suma en "Otros". */
const TOP_COUNTRIES = 8;

const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/** El período que termina hoy (UTC) y el anterior, de la misma cantidad de días. */
export function periodRange(period: Period, now: Date) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const from = today - (period - 1) * DAY_MS;
  return {
    from: isoDay(from),
    to: isoDay(today),
    previousFrom: isoDay(from - period * DAY_MS),
    previousTo: isoDay(from - DAY_MS),
  };
}

function totalsOf(rows: readonly DailyRow[]): Totals {
  const views = rows.reduce((sum, row) => sum + row.views, 0);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  return { views, clicks, ctr: views > 0 ? clicks / views : null };
}

/** Rellena con ceros los días sin datos, para que el gráfico no salte días. */
function fillDays(rows: readonly DailyRow[], from: string, period: Period): DailyRow[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const start = Date.parse(`${from}T00:00:00Z`);
  return Array.from({ length: period }, (_, index) => {
    const day = isoDay(start + index * DAY_MS);
    return byDay.get(day) ?? { day, views: 0, clicks: 0 };
  });
}

function byViewsThenClicks(a: BreakdownRow, b: BreakdownRow): number {
  return b.views - a.views || b.clicks - a.clicks || a.value.localeCompare(b.value);
}

export function buildStatsView(input: {
  readonly period: Period;
  readonly now: Date;
  readonly daily: readonly DailyRow[];
  readonly links: readonly LinkClicksRow[];
  readonly breakdown: readonly BreakdownRow[];
}): StatsView {
  const range = periodRange(input.period, input.now);
  const current = input.daily.filter((row) => row.day >= range.from && row.day <= range.to);
  const previous = input.daily.filter(
    (row) => row.day >= range.previousFrom && row.day <= range.previousTo,
  );
  const totals = totalsOf(current);

  const countries = input.breakdown
    .filter((row) => row.dimension === "country")
    .sort(byViewsThenClicks);
  const others = countries.slice(TOP_COUNTRIES);
  const topCountries =
    others.length > 0
      ? [
          ...countries.slice(0, TOP_COUNTRIES),
          {
            dimension: "country" as const,
            value: "otros",
            views: others.reduce((sum, row) => sum + row.views, 0),
            clicks: others.reduce((sum, row) => sum + row.clicks, 0),
          },
        ]
      : countries;

  // Orígenes en el orden fijo de la lista: así se comparan entre períodos.
  const sourceRows = new Map(
    input.breakdown.filter((row) => row.dimension === "source").map((row) => [row.value, row]),
  );
  const sources = TRAFFIC_SOURCES.flatMap((source: TrafficSource) => {
    const row = sourceRows.get(source);
    return row && (row.views > 0 || row.clicks > 0) ? [row] : [];
  });

  return {
    period: input.period,
    from: range.from,
    to: range.to,
    current: totals,
    previous: totalsOf(previous),
    days: fillDays(current, range.from, input.period),
    links: [...input.links]
      .filter((link) => link.clicks > 0)
      .sort((a, b) => b.clicks - a.clicks || a.title.localeCompare(b.title))
      .map((link) => ({
        ...link,
        ctr: totals.views > 0 ? link.clicks / totals.views : null,
      })),
    countries: topCountries,
    sources,
    empty: totals.views === 0 && totals.clicks === 0,
  };
}

/** Lee lo necesario (el período y el anterior) y arma la vista. */
export async function loadStatsView(
  reader: StatsReader,
  pageId: string,
  period: Period,
  now: Date,
): Promise<StatsView> {
  const range = periodRange(period, now);
  const [daily, links, breakdown] = await Promise.all([
    reader.daily(pageId, range.previousFrom, range.to),
    reader.linkClicks(pageId, range.from, range.to),
    reader.breakdown(pageId, range.from, range.to),
  ]);
  return buildStatsView({ period, now, daily, links, breakdown });
}

/** Cambio respecto del período anterior: "+25 %", "−10 %", "igual" o "nuevo". */
export function changeLabel(current: number, previous: number): string {
  if (current === previous) return "igual";
  if (previous === 0) return "nuevo";
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return "igual";
  return percent > 0 ? `+${String(percent)} %` : `−${String(Math.abs(percent))} %`;
}
