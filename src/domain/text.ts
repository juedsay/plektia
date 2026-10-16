import { z } from "zod";

import { invalidInput, type InvalidInput } from "@/domain/errors";
import { err, ok, type Result } from "@/domain/result";

// Textos de una línea que se muestran en la página pública (títulos, descripciones).
// Además de los caracteres de control, se rechazan los invisibles y los de
// dirección del texto: con U+202E, "factura\u202efdp.exe" se ve como "facturaexe.pdf".
// eslint-disable-next-line no-control-regex -- detectar caracteres de control es el objetivo.
const UNSAFE = /[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/;

export function safeLine(label: string, max: number) {
  return z
    .string({ error: `${label} tiene que ser un texto.` })
    .trim()
    .min(1, { error: `${label} no puede estar vacío.` })
    .max(max, { error: `${label} puede tener hasta ${String(max)} caracteres.` })
    .refine((value) => !UNSAFE.test(value), {
      error: `${label} tiene caracteres no permitidos (saltos de línea, invisibles o de control).`,
    });
}

/** Valida con un schema y devuelve el primer mensaje de cada campo. */
export function validate<T>(schema: z.ZodType<T>, raw: unknown): Result<T, InvalidInput> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);

  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    fields[field] ??= issue.message;
  }
  return err(invalidInput(fields));
}
