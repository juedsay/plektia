import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImageStorage } from "@/application/ports/image-storage";
import { err, ok, type Result } from "@/domain/result";
import type { Database } from "@/infrastructure/supabase/database.types";

/**
 * Imágenes en un bucket de Supabase Storage con el cliente de la sesión: las
 * políticas del bucket solo dejan escribir y borrar en la carpeta `{auth.uid()}`
 * (nunca la `service_role`). El tipo sale de la ruta, no del navegador.
 */
export class SupabaseImageStorage implements ImageStorage {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly bucket: string,
    private readonly contentTypeOf: (path: string) => string | null,
  ) {}

  async upload(path: string, bytes: Uint8Array): Promise<Result<void, "rejected">> {
    const contentType = this.contentTypeOf(path);
    if (!contentType) return err("rejected");
    const { error } = await this.client.storage.from(this.bucket).upload(path, bytes, {
      contentType,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      // Sin esto, un rechazo de Storage (la política, el token, el tamaño) no deja rastro.
      const status = "statusCode" in error ? String(error.statusCode) : "?";
      console.warn(`storage: ${this.bucket} rechazó la subida (${status})`, error.message);
      return err("rejected");
    }
    return ok(undefined);
  }

  async remove(path: string): Promise<void> {
    // Si el archivo ya no estaba, Storage no lo trata como error; un error de red
    // deja un archivo de más en la carpeta propia, no rompe la página.
    await this.client.storage.from(this.bucket).remove([path]);
  }
}
