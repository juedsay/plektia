import { z } from "zod";

import type { InvalidInput } from "@/domain/errors";
import { HandleSchema, RESERVED_HANDLES, type Handle } from "@/domain/handle";
import type { Result } from "@/domain/result";
import { safeLine, validate } from "@/domain/text";

// Página pública de una cuenta (SPEC-pages). Una cuenta tiene al menos una y
// hasta `PAGE_LIMIT`; la base aplica el mismo límite con un trigger.

export const PAGE_LIMIT = 3;

const PageHandle = z
  .string({ error: "El nombre de usuario tiene que ser un texto." })
  .trim()
  .toLowerCase()
  .refine((value) => HandleSchema.safeParse(value).success, {
    error:
      "El nombre de usuario tiene de 3 a 30 caracteres: minúsculas, números y guiones simples.",
    abort: true,
  })
  .refine((value) => !RESERVED_HANDLES.has(value), {
    error: "Ese nombre de usuario está reservado.",
  })
  .transform((value) => value as Handle);

const PageInputSchema = z.object(
  { handle: PageHandle, displayName: safeLine("El nombre", 60) },
  { error: "Los datos de la página no son válidos." },
);

export interface PageDraft {
  readonly handle: Handle;
  readonly displayName: string;
}

export function parsePageInput(raw: unknown): Result<PageDraft, InvalidInput> {
  return validate(PageInputSchema, raw);
}
