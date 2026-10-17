import { describe, expect, it } from "vitest";

import { createContactSender } from "@/composition/contact";
import type { IngestClient } from "@/infrastructure/supabase/ingest-client";

describe("createContactSender", () => {
  it("arma el envío: con el límite agotado no llega a la base", async () => {
    const calls: unknown[] = [];
    const ingest: IngestClient = {
      call: (fn) => {
        calls.push(fn);
        return Promise.resolve({ error: null });
      },
    };
    const send = createContactSender({
      ingest,
      turnstileSecret: "s",
      limiter: { allow: () => Promise.resolve(false) },
    });
    const result = await send({ fields: {}, turnstileToken: "t", ip: null });
    expect(result).toEqual({ ok: false, error: "rate_limited" });
    expect(calls).toEqual([]);
  });
});
