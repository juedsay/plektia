import { z } from "zod";

import { type InvalidInput, invalidInput } from "@/domain/errors";
import { type Handle, parseHandle } from "@/domain/handle";
import { err, ok, type Result } from "@/domain/result";

// Invitación de una persona por el owner (SPEC-admin-panel, "Usuarios
// habilitados"). La base vuelve a validar todo (formato, reservados, tomados).

export interface Invite {
  readonly email: string;
  readonly handle: Handle;
}

const EmailSchema = z.email().max(254);

/** El email de una cuenta o invitación, normalizado (minúsculas, sin espacios). */
export function parseEmail(raw: unknown): Result<string, InvalidInput> {
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return EmailSchema.safeParse(email).success
    ? ok(email)
    : err(invalidInput({ email: "Escribí un correo válido." }));
}

export function parseInvite(raw: unknown): Result<Invite, InvalidInput> {
  const fields = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const email = parseEmail(fields["email"]);
  const handle = parseHandle(fields["handle"]);
  const errors: Record<string, string> = {};
  if (!email.ok) errors["email"] = email.error.fields["email"] ?? "Escribí un correo válido.";
  if (!handle.ok) {
    errors["handle"] =
      handle.error === "reserved_handle"
        ? "Ese nombre de usuario está reservado."
        : "De 3 a 30 caracteres: letras minúsculas, números y guiones simples.";
  }
  if (!email.ok || !handle.ok) return err(invalidInput(errors));
  return ok({ email: email.value, handle: handle.value });
}
