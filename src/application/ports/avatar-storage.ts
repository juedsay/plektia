import type { Result } from "@/domain/result";

/** Archivos de avatar (Supabase Storage, bucket `avatars`), con la sesión de quien sube. */
export interface AvatarStorage {
  /** Sube un WebP ya validado; `rejected` si Storage no lo aceptó (políticas, tamaño, tipo). */
  upload(path: string, bytes: Uint8Array): Promise<Result<void, "rejected">>;
  /** Borra un archivo; si ya no estaba, no es un error. */
  remove(path: string): Promise<void>;
}
