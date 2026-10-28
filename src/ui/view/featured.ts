import type { PublicFeatured } from "@/application/ports/public-page-reader";

// Presentación del contenido destacado de un link de YouTube (la sub-fila
// plegable de la página pública). Funciones puras: el componente solo pinta.

const LABELS: Readonly<Record<PublicFeatured["kind"], string>> = {
  video: "Último video",
  short: "Último Short",
  stream: "Último directo",
};

/** "Último video", "Último Short", "Último directo" o "Destacado" (fijado). */
export function featuredLabel(featured: Pick<PublicFeatured, "kind" | "pinned">): string {
  return featured.pinned ? "Destacado" : LABELS[featured.kind];
}

const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "hace 2 días", "hace 3 horas"; "recién" si no pasó un minuto. */
export function timeAgo(isoDate: string, now: Date): string {
  const seconds = Math.max(0, (now.getTime() - Date.parse(isoDate)) / 1000);
  const format = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (seconds >= size) return format.format(-Math.floor(seconds / size), unit);
  }
  return "recién";
}

/** 754 → "12:34"; 3723 → "1:02:03". */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${String(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${String(minutes)}:${pad(seconds)}`;
}

/** Para lectores de pantalla: 754 → "12 minutos 34 segundos". */
export function spokenDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const part = (value: number, one: string, many: string) =>
    value === 0 ? null : `${String(value)} ${value === 1 ? one : many}`;
  return (
    [
      part(hours, "hora", "horas"),
      part(minutes, "minuto", "minutos"),
      part(seconds, "segundo", "segundos"),
    ]
      .filter(Boolean)
      .join(" ") || "0 segundos"
  );
}

/** Dónde se mira: un Short en su reproductor vertical; el resto, el normal. */
export function watchUrl(featured: Pick<PublicFeatured, "videoId" | "kind">): string {
  return featured.kind === "short"
    ? `https://www.youtube.com/shorts/${featured.videoId}`
    : `https://www.youtube.com/watch?v=${featured.videoId}`;
}

/** La miniatura, servida desde el propio sitio (la página no le pide nada a YouTube). */
export function thumbPath(videoId: string): string {
  return `/thumbs/${videoId}.jpg`;
}

/** Nombre accesible del enlace al video: qué es, el título y cuánto dura. */
export function watchLabel(featured: PublicFeatured): string {
  const duration =
    featured.durationSeconds && featured.durationSeconds > 0
      ? `, ${spokenDuration(featured.durationSeconds)}`
      : "";
  return `Ver en YouTube: ${featured.title}${duration}`;
}
