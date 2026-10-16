import type { WriteError } from "@/application/ports/link-repository";
import type { InvalidInput } from "@/domain/errors";
import type { Result } from "@/domain/result";

/** Errores de un caso de uso de escritura: validación (con campos) o del repositorio. */
export type UseCaseError = InvalidInput | WriteError;

export type UseCaseResult<T> = Promise<Result<T, UseCaseError>>;

/** Campo `changes` de un comando `{ id, version, changes }` (o `undefined`). */
export function changesOf(raw: unknown): unknown {
  return typeof raw === "object" && raw !== null && "changes" in raw ? raw.changes : undefined;
}
