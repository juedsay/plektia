import { describe, expect, it } from "vitest";

import { quotaBuckets, YOUTUBE_QUOTA } from "@/composition/live";

const OWNER = "11111111-1111-4111-8111-111111111111";

describe("quotaBuckets: la cuota de YouTube por trabajo", () => {
  it("cada cron descuenta del total y de su fondo", () => {
    expect(quotaBuckets({ job: "live" })).toEqual([
      { name: "youtube", limit: YOUTUBE_QUOTA.total },
      { name: "youtube:live", limit: YOUTUBE_QUOTA.live },
    ]);
    expect(quotaBuckets({ job: "featured" })).toEqual([
      { name: "youtube", limit: YOUTUBE_QUOTA.total },
      { name: "youtube:featured", limit: YOUTUBE_QUOTA.featured },
    ]);
  });

  it("Comprobar ahora descuenta además del fondo de la cuenta", () => {
    expect(quotaBuckets({ job: "check-now", ownerId: OWNER })).toEqual([
      { name: "youtube", limit: YOUTUBE_QUOTA.total },
      { name: "youtube:check-now", limit: YOUTUBE_QUOTA.checkNow },
      { name: `youtube:check-now:${OWNER}`, limit: YOUTUBE_QUOTA.checkNowPerAccount },
    ]);
  });

  it("los fondos de los trabajos entran en el total", () => {
    expect(YOUTUBE_QUOTA.live + YOUTUBE_QUOTA.featured + YOUTUBE_QUOTA.checkNow).toBe(
      YOUTUBE_QUOTA.total,
    );
  });

  it("los nombres cumplen el formato que exige la base", () => {
    const names = [
      ...quotaBuckets({ job: "live" }),
      ...quotaBuckets({ job: "featured" }),
      ...quotaBuckets({ job: "check-now", ownerId: OWNER }),
    ].map((bucket) => bucket.name);
    for (const name of names) {
      expect(name).toMatch(/^[a-z]+(:[a-z-]+)?(:[0-9a-f-]{36})?$/);
    }
  });
});
