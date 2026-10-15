import type { RateLimiter } from "@/application/ports/rate-limiter";

/** Rate Limiting de Workers: contadores por ubicación de Cloudflare, sin latencia de red. */
export class CloudflareRateLimiter implements RateLimiter {
  constructor(private readonly binding: Pick<RateLimit, "limit">) {}

  async allow(key: string): Promise<boolean> {
    const { success } = await this.binding.limit({ key });
    return success;
  }
}
