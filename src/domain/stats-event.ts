import { z } from "zod";

import { HandleSchema } from "@/domain/handle";
import { TRAFFIC_SOURCES, type TrafficSource } from "@/domain/traffic-source";

// Un evento del beacon (SPEC-click-analytics): solo `t`, `h` o `l`, y `s`.
// Cualquier otra cosa no es un evento (se descarta en silencio).

export type StatsEvent =
  | { readonly type: "view"; readonly handle: string; readonly source: TrafficSource }
  | { readonly type: "click"; readonly linkId: string; readonly source: TrafficSource };

const Source = z.enum(TRAFFIC_SOURCES);
const EventSchema = z.discriminatedUnion("t", [
  z.strictObject({ t: z.literal("view"), h: z.string().max(30).pipe(HandleSchema), s: Source }),
  z.strictObject({ t: z.literal("click"), l: z.uuid(), s: Source }),
]);

/** `null` si no es un evento válido (campos de más, de menos o fuera de rango). */
export function parseStatsEvent(raw: unknown): StatsEvent | null {
  const parsed = EventSchema.safeParse(raw);
  if (!parsed.success) return null;
  const event = parsed.data;
  return event.t === "view"
    ? { type: "view", handle: event.h.toLowerCase(), source: event.s }
    : { type: "click", linkId: event.l, source: event.s };
}

/** País de dos letras (de Cloudflare); cualquier otra cosa es "XX". */
export function normalizeCountry(value: unknown): string {
  return typeof value === "string" && /^[A-Z]{2}$/.test(value) ? value : "XX";
}
