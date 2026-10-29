// Presentación de las estadísticas del panel: nombres, porcentajes y fechas.
// Funciones puras: los componentes solo pintan.

const SOURCE_NAMES: Readonly<Record<string, string>> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  direct: "Directo",
  other: "Otros sitios",
};

export function sourceName(value: string): string {
  return SOURCE_NAMES[value] ?? value;
}

const regions = new Intl.DisplayNames(["es"], { type: "region" });

/** `AR` → "Argentina"; `XX` → "Sin dato"; `otros` → "Otros países". */
export function countryName(value: string): string {
  if (value === "otros") return "Otros países";
  if (!/^[A-Z]{2}$/.test(value) || value === "XX") return "Sin dato";
  try {
    return regions.of(value) ?? value;
  } catch {
    return value;
  }
}

/** 0.1234 → "12,3 %"; `null` (sin visitas) → "—". */
export function percent(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${(ratio * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;
}

export function count(value: number): string {
  return value.toLocaleString("es-AR");
}

/** `2026-10-28` → "28 oct." (día UTC: es como se guardan los contadores). */
export function shortDay(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
