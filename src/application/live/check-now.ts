import type { LiveRefreshSummary } from "@/application/live/refresh-live";
import type { RateLimiter } from "@/application/ports/rate-limiter";
import { err, ok, type Result } from "@/domain/result";

// "Comprobar ahora" (SPEC-live-status, historia 3): el dueño fuerza una
// revisión de sus canales vigilados. Primero el límite (una vez por minuto por
// cuenta, para no gastar la cuota), y recién después el refresco de sus canales.

export type CheckNowError = "rate_limited" | "unavailable";

export function checkNow(deps: {
  readonly limiter: RateLimiter;
  /** El refresco de una cuenta; `null` si no hay credenciales de ningún proveedor. */
  readonly refresh: ((ownerId: string) => Promise<LiveRefreshSummary>) | null;
}) {
  return async (ownerId: string): Promise<Result<LiveRefreshSummary, CheckNowError>> => {
    if (!deps.refresh) return err("unavailable");
    if (!(await deps.limiter.allow(`check-now:${ownerId}`))) return err("rate_limited");
    return ok(await deps.refresh(ownerId));
  };
}
