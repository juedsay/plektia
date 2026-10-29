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

// Presentación de una página: lo que se edita en /admin/page (SPEC-admin-panel,
// "Perfil"). La v1 trae un solo tema; los otros figuran como "Próximamente".
export const AVAILABLE_THEMES = ["tecnico"] as const;
export const UPCOMING_THEMES = ["cercano", "energico", "editorial"] as const;
export type Theme = (typeof AVAILABLE_THEMES)[number];

/**
 * Modo de la página (SPEC-appearance): `auto` sigue al dispositivo de cada
 * visitante; `dark` y `light` lo fijan. Es independiente del tema.
 */
export const COLOR_MODES = ["auto", "dark", "light"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export const BIO_MAX_LENGTH = 160;

const Bio = z
  .string({ error: "La bio tiene que ser un texto." })
  .trim()
  .pipe(z.union([z.literal("").transform(() => null), safeLine("La bio", BIO_MAX_LENGTH)]));

const PageSettingsSchema = z.object(
  {
    displayName: safeLine("El nombre", 60),
    bio: Bio.default(""),
    theme: z.enum(AVAILABLE_THEMES, { error: "Ese tema todavía no está disponible." }),
    colorMode: z.enum(COLOR_MODES, { error: "Elegí automático, oscuro o claro." }).default("auto"),
    showHandle: z.boolean({ error: "Tiene que ser sí o no." }),
  },
  { error: "Los datos de la página no son válidos." },
);

export interface PageSettings {
  readonly displayName: string;
  readonly bio: string | null;
  readonly theme: Theme;
  readonly colorMode: ColorMode;
  readonly showHandle: boolean;
}

export function parsePageSettings(raw: unknown): Result<PageSettings, InvalidInput> {
  return validate(PageSettingsSchema, raw);
}
