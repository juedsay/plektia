import { z } from "zod";

import { type InvalidInput, invalidInput } from "@/domain/errors";
import { err, ok, type Result } from "@/domain/result";

const RequestId = z.object({ id: z.uuid().optional() });

/**
 * El id (UUID) que el panel genera para lo que crea. Hace idempotente el alta: si
 * el mismo pedido llega dos veces (doble clic, reintento de red), el segundo
 * devuelve lo que ya se creó en lugar de duplicarlo. Sin id, la base elige uno.
 */
export function requestIdOf(raw: unknown): Result<string | undefined, InvalidInput> {
  const parsed = RequestId.safeParse(raw);
  return parsed.success
    ? ok(parsed.data.id)
    : err(invalidInput({ id: "El identificador del pedido no es válido." }));
}
