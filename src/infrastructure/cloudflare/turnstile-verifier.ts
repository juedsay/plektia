import { z } from "zod";

import type { HumanVerifier } from "@/application/ports/contact";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const ATTEMPTS = 2;
const TIMEOUT_MS = 5000;

const Answer = z.object({
  success: z.boolean(),
});

/**
 * Verifica el token de Turnstile en el servidor (el widget solo no alcanza: un
 * bot puede saltearlo). Falla cerrado: sin una respuesta clara de Cloudflare,
 * no es una persona. Los dominios donde el widget puede emitir tokens se
 * configuran en el propio widget, en Cloudflare.
 */
export class TurnstileVerifier implements HumanVerifier {
  constructor(
    private readonly secret: string,
    // Envuelto: en Workers, `fetch` guardado como propiedad y llamado como
    // `this.fetcher(...)` falla con "Illegal invocation" (pierde su `this`).
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  async verify(token: string, ip: string | null): Promise<boolean> {
    if (!this.secret) return false;
    // Con la misma `idempotency_key`, Cloudflare acepta reintentar el token sin
    // tomarlo como reutilizado: un corte de red no le cuesta el envío a nadie.
    const body = JSON.stringify({
      secret: this.secret,
      response: token,
      idempotency_key: crypto.randomUUID(),
      ...(ip ? { remoteip: ip } : {}),
    });
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        const response = await this.fetcher(SITEVERIFY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) return false;
        const answer = Answer.safeParse(await response.json());
        return answer.success && answer.data.success;
      } catch (error) {
        // Falla cerrado, pero deja rastro: sin esto un problema de red parece un bot.
        console.warn(
          `turnstile: no se pudo verificar el token (intento ${String(attempt)})`,
          error,
        );
      }
    }
    return false;
  }
}
