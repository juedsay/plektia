import { describe, expect, it } from "vitest";

import type { StatsRecorder } from "@/application/ports/stats-recorder";
import { recordEvent } from "@/application/stats/record-event";
import type { StatsEvent } from "@/domain/stats-event";

function setup(allowed = true) {
  const recorded: { event: StatsEvent; country: string; viewerId: string | null }[] = [];
  const limited: string[] = [];
  const recorder: StatsRecorder = {
    record: (event, country, viewerId) => {
      recorded.push({ event, country, viewerId });
      return Promise.resolve();
    },
  };
  const run = recordEvent({
    recorder,
    limiter: {
      allow: (key) => {
        limited.push(key);
        return Promise.resolve(allowed);
      },
    },
  });
  return { run, recorded, limited };
}

const view = JSON.stringify({ t: "view", h: "juedsay", s: "direct" });

describe("recordEvent", () => {
  it("suma el evento con el país normalizado y quien mira", async () => {
    const { run, recorded, limited } = setup();
    const outcome = await run({ body: view, ip: "203.0.113.7", country: "AR", viewerId: "dueño" });
    expect(outcome).toBe("recorded");
    expect(recorded).toEqual([
      {
        event: { type: "view", handle: "juedsay", source: "direct" },
        country: "AR",
        viewerId: "dueño",
      },
    ]);
    expect(limited).toEqual(["stats:203.0.113.7"]);
  });

  it("pasado el límite por IP no suma nada", async () => {
    const { run, recorded } = setup(false);
    const outcome = await run({ body: view, ip: "203.0.113.7", country: "AR", viewerId: null });
    expect(outcome).toBe("rate_limited");
    expect(recorded).toEqual([]);
  });

  it("un cuerpo que no es JSON o no es un evento no suma (y consume el límite igual)", async () => {
    const { run, recorded, limited } = setup();
    expect(await run({ body: "{", ip: "1", country: null, viewerId: null })).toBe("invalid");
    const partial = JSON.stringify({ t: "view" });
    expect(await run({ body: partial, ip: "1", country: null, viewerId: null })).toBe("invalid");
    expect(recorded).toEqual([]);
    expect(limited).toHaveLength(2);
  });
});
