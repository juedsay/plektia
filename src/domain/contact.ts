import { z } from "zod";

import type { InvalidInput } from "@/domain/errors";
import type { Result } from "@/domain/result";
import { safeLine, safeText, validate } from "@/domain/text";

// Mensaje del formulario de contacto (SPEC-public-page, "Contacto"). La base
// repite los límites con `check`, por si alguien llega sin pasar por la app.

export const CONTACT_LIMITS = { name: 80, email: 254, message: 2000 } as const;

const ContactSchema = z.object(
  {
    name: safeLine("Tu nombre", CONTACT_LIMITS.name),
    email: z
      .string({ error: "Tu email tiene que ser un texto." })
      .trim()
      .max(CONTACT_LIMITS.email, { error: "Tu email es demasiado largo." })
      .pipe(z.email({ error: "Revisá tu email: no parece válido." })),
    message: safeText("El mensaje", CONTACT_LIMITS.message),
  },
  { error: "Los datos del mensaje no son válidos." },
);

export interface ContactMessage {
  readonly name: string;
  readonly email: string;
  readonly message: string;
}

export function parseContactInput(raw: unknown): Result<ContactMessage, InvalidInput> {
  return validate(ContactSchema, raw);
}

/** Nombre del campo trampa: invisible para las personas, tentador para los bots. */
export const HONEYPOT_FIELD = "website";

/** Un bot completa todos los campos, incluido el que una persona no ve. */
export function looksLikeBot(raw: Readonly<Record<string, unknown>>): boolean {
  const trap = raw[HONEYPOT_FIELD];
  return typeof trap === "string" && trap.trim() !== "";
}
