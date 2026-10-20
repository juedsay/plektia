import type { ContactInbox, HumanVerifier } from "@/application/ports/contact";
import type { RateLimiter } from "@/application/ports/rate-limiter";
import { looksLikeBot, parseContactInput } from "@/domain/contact";
import type { InvalidInput } from "@/domain/errors";
import { err, ok, type Result } from "@/domain/result";

export type SendContactError = InvalidInput | "rate_limited" | "not_human" | "limit_reached";

export interface ContactSubmission {
  readonly fields: Readonly<Record<string, unknown>>;
  /** Token del widget de Turnstile (`cf-turnstile-response`). */
  readonly turnstileToken: unknown;
  readonly ip: string | null;
}

/**
 * Envía un mensaje de contacto. El orden importa:
 * 1. Límite por IP antes que nada: un ataque no llega a gastar verificaciones.
 * 2. Campo trampa: al bot se le contesta "enviado" sin guardar, para no darle pistas.
 * 3. Validación, y recién con datos válidos la verificación de Turnstile (que
 *    consume el token: no tiene sentido gastarlo en un formulario con errores).
 */
export function sendContactMessage(deps: {
  inbox: ContactInbox;
  verifier: HumanVerifier;
  limiter: RateLimiter;
}) {
  return async (submission: ContactSubmission): Promise<Result<void, SendContactError>> => {
    if (!(await deps.limiter.allow(`contacto:${submission.ip ?? "desconocida"}`))) {
      return err("rate_limited");
    }
    if (looksLikeBot(submission.fields)) return ok(undefined);

    const message = parseContactInput(submission.fields);
    if (!message.ok) return message;

    const token = submission.turnstileToken;
    if (typeof token !== "string" || token === "" || token.length > 2048) return err("not_human");
    if (!(await deps.verifier.verify(token, submission.ip))) return err("not_human");

    return deps.inbox.save(message.value);
  };
}
