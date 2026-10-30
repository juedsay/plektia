import { isAvailableTheme, type Theme as ThemeId } from "@/domain/theme";
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
// "Perfil"). Los estilos (variantes de tema) viven en theme.ts (SPEC-styles).
export { AVAILABLE_THEMES, type Theme } from "@/domain/theme";

/**
 * Modo de la página (SPEC-appearance): `auto` sigue al dispositivo de cada
 * visitante; `dark` y `light` lo fijan. Es independiente del tema.
 */
export const COLOR_MODES = ["auto", "dark", "light"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

/**
 * Acento de la página (SPEC-appearance, 36a): una paleta curada, cada uno con
 * su tono para oscuro y para claro en tokens.css. `hueso` es el de siempre.
 */
export const ACCENTS = [
  "hueso",
  "coral",
  "ambar",
  "cielo",
  "lavanda",
  "rosa",
  "turquesa",
  "arena",
] as const;
export type Accent = (typeof ACCENTS)[number];

/**
 * Forma de los links (SPEC-appearance, 36b): `rows` es la de siempre (filas
 * con una línea), `cards` un recuadro por link y `pills` una cápsula.
 */
export const LINK_SHAPES = ["rows", "cards", "pills"] as const;
export type LinkShape = (typeof LINK_SHAPES)[number];

/**
 * Tipografía de los nombres (SPEC-appearance, 36c): `bricolage` es la de la
 * marca; las otras se sirven desde el sitio y se cargan solo donde se usan.
 */
export const NAME_FONTS = ["bricolage", "fraunces", "nunito", "space_mono"] as const;
export type NameFont = (typeof NAME_FONTS)[number];

export const BIO_MAX_LENGTH = 160;

const Bio = z
  .string({ error: "La bio tiene que ser un texto." })
  .trim()
  .pipe(z.union([z.literal("").transform(() => null), safeLine("La bio", BIO_MAX_LENGTH)]));

const PageSettingsSchema = z.object(
  {
    displayName: safeLine("El nombre", 60),
    bio: Bio.default(""),
    theme: z
      .string({ error: "Elegí un estilo de la lista." })
      .refine(isAvailableTheme, { error: "Ese estilo todavía no está disponible." }),
    colorMode: z.enum(COLOR_MODES, { error: "Elegí automático, oscuro o claro." }).default("auto"),
    accent: z.enum(ACCENTS, { error: "Elegí uno de los acentos de la lista." }).default("hueso"),
    linkShape: z.enum(LINK_SHAPES, { error: "Elegí filas, tarjetas o pastillas." }).default("rows"),
    nameFont: z
      .enum(NAME_FONTS, { error: "Elegí una de las tipografías de la lista." })
      .default("bricolage"),
    showHandle: z.boolean({ error: "Tiene que ser sí o no." }),
  },
  { error: "Los datos de la página no son válidos." },
);

export interface PageSettings {
  readonly displayName: string;
  readonly bio: string | null;
  readonly theme: ThemeId;
  readonly colorMode: ColorMode;
  readonly accent: Accent;
  readonly linkShape: LinkShape;
  readonly nameFont: NameFont;
  readonly showHandle: boolean;
}

export function parsePageSettings(raw: unknown): Result<PageSettings, InvalidInput> {
  return validate(PageSettingsSchema, raw);
}
