import type { ContactMessage } from "@/domain/contact";
import type { Result } from "@/domain/result";

/** Donde quedan los mensajes de contacto (la base; el panel los lee en F5). */
export interface ContactInbox {
  /** `limit_reached`: la base frenó una inundación (tope global por hora). */
  save(message: ContactMessage): Promise<Result<void, "limit_reached">>;
}

/** Comprueba que quien envía es una persona (Turnstile). */
export interface HumanVerifier {
  verify(token: string, ip: string | null): Promise<boolean>;
}
