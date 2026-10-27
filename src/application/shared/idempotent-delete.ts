import type { WriteError } from "@/application/ports/link-repository";
import { ok, type Result } from "@/domain/result";

/**
 * Borrar es idempotente: si ya no existe (el mismo pedido llegó dos veces, o el
 * borrado al cerrar la pestaña ya salió), el resultado buscado ya se cumple. Un
 * conflicto de versión sí se informa: alguien lo cambió y no se borra a ciegas.
 */
export function alreadyGone(result: Result<void, WriteError>): Result<void, WriteError> {
  return !result.ok && result.error === "not_found" ? ok(undefined) : result;
}
