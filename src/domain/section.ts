import { z } from "zod";

import type { InvalidInput } from "@/domain/errors";
import { map, type Result } from "@/domain/result";
import { safeLine, validate } from "@/domain/text";

// Sección de la página pública (SPEC-links). "Sin sección" no es una fila: son
// los links con `section_id` nulo.

const Title = safeLine("El título", 40);
const Flag = z.boolean({ error: "Tiene que ser sí o no." });
/** El rótulo que reemplaza al automático ("Lado A", "L1"…); vacío vuelve al automático. */
const Label = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  safeLine("El rótulo", 16).nullable(),
);

const SectionInputSchema = z.object(
  { title: Title, showTitle: Flag.default(true), visible: Flag.default(true) },
  { error: "Los datos de la sección no son válidos." },
);

const SectionPatchSchema = z
  .object(
    {
      title: Title.optional(),
      showTitle: Flag.optional(),
      visible: Flag.optional(),
      label: Label.optional(),
    },
    { error: "Los datos de la sección no son válidos." },
  )
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    error: "No hay ningún cambio para guardar.",
  });

export interface SectionDraft {
  readonly title: string;
  readonly showTitle: boolean;
  readonly visible: boolean;
}

export type SectionPatch = Partial<SectionDraft> & { readonly label?: string | null };

export function parseSectionInput(raw: unknown): Result<SectionDraft, InvalidInput> {
  return validate(SectionInputSchema, raw);
}

export function parseSectionPatch(raw: unknown): Result<SectionPatch, InvalidInput> {
  return map(
    validate(SectionPatchSchema, raw),
    (patch) =>
      Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      ) as SectionPatch,
  );
}
