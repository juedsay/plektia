import { describe, expect, it, vi } from "vitest";

import { CloudflareRateLimiter } from "@/infrastructure/cloudflare/cloudflare-rate-limiter";

describe("CloudflareRateLimiter", () => {
  it.each([true, false])("devuelve lo que decide el binding (%s)", async (success) => {
    const limit = vi.fn(() => Promise.resolve({ success }));
    expect(await new CloudflareRateLimiter({ limit }).allow("1.2.3.4:/auth/login")).toBe(success);
    expect(limit).toHaveBeenCalledWith({ key: "1.2.3.4:/auth/login" });
  });
});
