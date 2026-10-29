// Lectura de las estadísticas de una página (SPEC-click-analytics, "Panel").
// Con la sesión del dueño: la RLS solo deja ver las de sus páginas. Las fechas
// son días UTC en formato `YYYY-MM-DD`, ambos extremos incluidos.

export interface DailyRow {
  readonly day: string;
  readonly views: number;
  readonly clicks: number;
}

export interface LinkClicksRow {
  readonly linkId: string;
  readonly title: string;
  readonly clicks: number;
}

export interface BreakdownRow {
  readonly dimension: "country" | "source";
  readonly value: string;
  readonly views: number;
  readonly clicks: number;
}

export interface StatsReader {
  daily(pageId: string, from: string, to: string): Promise<readonly DailyRow[]>;
  /** Clics por link en el período (sumados), con el título actual del link. */
  linkClicks(pageId: string, from: string, to: string): Promise<readonly LinkClicksRow[]>;
  /** Países y orígenes del período (sumados). */
  breakdown(pageId: string, from: string, to: string): Promise<readonly BreakdownRow[]>;
}
