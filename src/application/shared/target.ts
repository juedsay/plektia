import { z } from "zod";

import type { Versioned } from "@/application/ports/link-repository";
import type { InvalidInput } from "@/domain/errors";
import type { Result } from "@/domain/result";
import { validate } from "@/domain/text";

// Lo que identifica un elemento a modificar: su id y la versión que se leyó.

const Id = z.uuid({ error: "El identificador no es válido." });
const Version = z
  .int({ error: "La versión no es válida." })
  .min(1, { error: "La versión no es válida." });

const TargetSchema = z.object(
  { id: Id, version: Version },
  { error: "Faltan el id y la versión." },
);

const OrderSchema = z.object(
  {
    items: z
      .array(TargetSchema, { error: "El orden tiene que ser una lista." })
      .max(500, { error: "La lista es demasiado larga." })
      .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
        error: "La lista tiene elementos repetidos.",
      }),
  },
  { error: "Falta el orden." },
);

export function parseTarget(raw: unknown): Result<Versioned, InvalidInput> {
  return validate(TargetSchema, raw);
}

export function parseOrder(raw: unknown): Result<{ items: readonly Versioned[] }, InvalidInput> {
  return validate(OrderSchema, raw);
}

export const SectionIdOrNull = Id.nullable();
