import type { Result } from "@/domain/result";

/** Archivos de imagen en un bucket de Supabase Storage, con la sesión de quien sube. */
export interface ImageStorage {
  /** Sube una imagen ya validada; `rejected` si Storage no la aceptó (políticas, tamaño, tipo). */
  upload(path: string, bytes: Uint8Array): Promise<Result<void, "rejected">>;
  /** Borra un archivo; si ya no estaba, no es un error. */
  remove(path: string): Promise<void>;
}
