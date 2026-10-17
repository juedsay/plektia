import type { SendContactError } from "@/application/contact/send-contact-message";

export interface ContactFeedback {
  /** Estado HTTP de la respuesta al formulario. */
  readonly status: number;
  /** Aviso general arriba del formulario; `null` si no hace falta. */
  readonly summary: string | null;
  /** Mensaje por campo, junto a cada uno. */
  readonly fields: Readonly<Record<string, string>>;
}

/** Qué ve la persona según cómo salió el envío (`null`: todavía no envió). */
export function contactFeedback(error: SendContactError | null): ContactFeedback {
  if (error === null) return { status: 200, summary: null, fields: {} };
  switch (error) {
    case "rate_limited":
      return {
        status: 429,
        summary: "Mandaste varios mensajes seguidos. Esperá un minuto y probá de nuevo.",
        fields: {},
      };
    case "not_human":
      return {
        status: 400,
        summary: "No pudimos confirmar que no sos un robot. Completá la verificación y reenviá.",
        fields: {},
      };
    case "limit_reached":
      return {
        status: 503,
        summary: "Estamos recibiendo muchos mensajes. Probá de nuevo en un rato.",
        fields: {},
      };
    default:
      return { status: 400, summary: "Revisá los campos marcados.", fields: error.fields };
  }
}
