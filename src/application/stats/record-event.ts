import type { RateLimiter } from "@/application/ports/rate-limiter";
import type { StatsRecorder } from "@/application/ports/stats-recorder";
import { normalizeCountry, parseStatsEvent } from "@/domain/stats-event";

// Un aviso del beacon (SPEC-click-analytics). Nunca devuelve un error a quien
// lo manda: el endpoint responde 204 siempre, así no revela qué páginas o
// links existen ni si el límite se agotó.

export interface BeaconRequest {
  /** El cuerpo ya leído (como mucho 512 bytes). */
  readonly body: string;
  /** Para el límite por IP (efímero: la IP no se guarda). */
  readonly ip: string;
  /** El país que informa Cloudflare. */
  readonly country: unknown;
  /** Quien tiene sesión, si la tiene: sus visitas a su propia página no cuentan. */
  readonly viewerId: string | null;
}

export type RecordOutcome = "recorded" | "rate_limited" | "invalid";

export function recordEvent(deps: { recorder: StatsRecorder; limiter: RateLimiter }) {
  return async (request: BeaconRequest): Promise<RecordOutcome> => {
    // Primero el límite: un script que manda basura también lo consume.
    if (!(await deps.limiter.allow(`stats:${request.ip}`))) return "rate_limited";
    let raw: unknown;
    try {
      raw = JSON.parse(request.body);
    } catch {
      return "invalid";
    }
    const event = parseStatsEvent(raw);
    if (!event) return "invalid";
    await deps.recorder.record(event, normalizeCountry(request.country), request.viewerId);
    return "recorded";
  };
}
