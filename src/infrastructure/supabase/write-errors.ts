import type { PostgrestError } from "@supabase/supabase-js";

import type { WriteError } from "@/application/ports/link-repository";
import { err, type Result } from "@/domain/result";

// SQLSTATE de la base (migraciones de links y páginas) → error del dominio.
const KNOWN_ERRORS: Readonly<Record<string, WriteError>> = {
  PL400: "invalid_input",
  PL404: "not_found",
  PL409: "conflict",
  PL429: "limit_reached",
  "42501": "forbidden", // RLS o privilegios
  "23514": "invalid_input", // check
  "23503": "not_found", // la sección se borró en el medio
  "23P01": "conflict", // posición repetida por una escritura simultánea
  "23505": "conflict", // el id elegido por el panel ya lo usa algo que no es de esta página
};

/** Un error esperable se devuelve como valor; cualquier otro se lanza. */
export function writeFailure(context: string, error: PostgrestError): Result<never, WriteError> {
  const known = KNOWN_ERRORS[error.code];
  if (known) return err(known);
  throw unexpectedDatabaseError(context, error);
}

export function unexpectedDatabaseError(context: string, error: PostgrestError): Error {
  return new Error(`${context}: error inesperado de la base (${error.code}): ${error.message}`);
}
