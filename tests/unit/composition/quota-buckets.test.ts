import { describe, expect, it } from "vitest";

import {
  liveRunsLeftToday,
  quotaBuckets,
  YOUTUBE_QUOTA,
  YOUTUBE_UNITS_PER_CHANNEL,
  youtubeChannelsPerRun,
} from "@/composition/live";

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

describe("liveRunsLeftToday: corridas del cron que faltan hasta la medianoche del Pacífico", () => {
  it("a la medianoche del Pacífico faltan las 144 del día", () => {
    // 08:00 UTC = 00:00 en Los Ángeles (horario de verano, -7).
    expect(liveRunsLeftToday(new Date("2026-07-01T07:00:00Z"))).toBe(144);
  });

  it("a las 23:55 del Pacífico queda una", () => {
    expect(liveRunsLeftToday(new Date("2026-07-01T06:55:00Z"))).toBe(1);
  });

  it("al mediodía del Pacífico (horario de invierno, -8) quedan 72", () => {
    expect(liveRunsLeftToday(new Date("2026-12-01T20:00:00Z"))).toBe(72);
  });
});

describe("youtubeChannelsPerRun: el fondo repartido entre las corridas que faltan", () => {
  it("con el fondo entero al empezar el día, unos 31 canales por corrida", () => {
    expect(youtubeChannelsPerRun(YOUTUBE_QUOTA.live, 144)).toBe(31);
  });

  it("si queda poco, revisa menos; si no queda nada, ninguno", () => {
    expect(youtubeChannelsPerRun(100, 10)).toBe(9);
    expect(youtubeChannelsPerRun(0, 10)).toBe(0);
  });

  it("con muchos canales, todo el día alcanza: nunca se gasta más que lo que le toca", () => {
    // 200 canales vigilados, todas las corridas del día: lo gastado no pasa el fondo.
    let remaining: number = YOUTUBE_QUOTA.live;
    for (let runsLeft = 144; runsLeft >= 1; runsLeft--) {
      const checked = Math.min(200, youtubeChannelsPerRun(remaining, runsLeft));
      remaining -= Math.ceil(checked * YOUTUBE_UNITS_PER_CHANNEL);
      expect(remaining).toBeGreaterThanOrEqual(0);
    }
  });
});
