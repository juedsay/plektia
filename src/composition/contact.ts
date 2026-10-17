import { sendContactMessage } from "@/application/contact/send-contact-message";
import type { RateLimiter } from "@/application/ports/rate-limiter";
import { TurnstileVerifier } from "@/infrastructure/cloudflare/turnstile-verifier";
import type { IngestClient } from "@/infrastructure/supabase/ingest-client";
import { SupabaseContactInbox } from "@/infrastructure/supabase/supabase-contact-inbox";

/** Arma el envío de mensajes de contacto con sus adaptadores. */
export function createContactSender(deps: {
  ingest: IngestClient;
  turnstileSecret: string;
  limiter: RateLimiter;
}) {
  return sendContactMessage({
    inbox: new SupabaseContactInbox(deps.ingest),
    verifier: new TurnstileVerifier(deps.turnstileSecret),
    limiter: deps.limiter,
  });
}
