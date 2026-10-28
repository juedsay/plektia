import { describe, expect, it } from "vitest";

import { checkNow } from "@/application/live/check-now";
import type { LiveRefreshSummary } from "@/application/live/refresh-live";

const summary: LiveRefreshSummary = { skipped: false, checked: 2, purged: [], failed: {} };

function setup(allowed: boolean, configured = true) {
  const limited: string[] = [];
  const refreshed: string[] = [];
  const run = checkNow({
    limiter: {
      allow: (key) => {
        limited.push(key);
        return Promise.resolve(allowed);
      },
    },
    refresh: configured
      ? (ownerId) => {
          refreshed.push(ownerId);
          return Promise.resolve(summary);
        }
      : null,
  });
  return { run, limited, refreshed };
}

describe("checkNow", () => {
  it("dentro del límite, revisa solo los canales de la cuenta", async () => {
    const { run, limited, refreshed } = setup(true);
    expect(await run("cuenta-1")).toEqual({ ok: true, value: summary });
    expect(limited).toEqual(["check-now:cuenta-1"]);
    expect(refreshed).toEqual(["cuenta-1"]);
  });

  it("más de una vez por minuto no gasta cuota", async () => {
    const { run, refreshed } = setup(false);
    expect(await run("cuenta-1")).toEqual({ ok: false, error: "rate_limited" });
    expect(refreshed).toEqual([]);
  });

  it("sin proveedores configurados no consume el límite", async () => {
    const { run, limited } = setup(true, false);
    expect(await run("cuenta-1")).toEqual({ ok: false, error: "unavailable" });
    expect(limited).toEqual([]);
  });
});
