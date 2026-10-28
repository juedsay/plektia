import type { SupabaseClient } from "@supabase/supabase-js";

import type { AvatarStorage } from "@/application/ports/avatar-storage";
import { err, ok, type Result } from "@/domain/result";
import type { Database } from "@/infrastructure/supabase/database.types";

const BUCKET = "avatars";

/**
 * Avatares en Supabase Storage con el cliente de la sesión: las políticas del
 * bucket solo dejan escribir y borrar en la carpeta `{auth.uid()}` (nunca la
 * `service_role`). El tipo va fijo: Storage lo devuelve tal cual al servirlo.
 */
export class SupabaseAvatarStorage implements AvatarStorage {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async upload(path: string, bytes: Uint8Array): Promise<Result<void, "rejected">> {
    const { error } = await this.client.storage.from(BUCKET).upload(path, bytes, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
    return error ? err("rejected") : ok(undefined);
  }

  async remove(path: string): Promise<void> {
    // Si el archivo ya no estaba, Storage no lo trata como error; un error de red
    // deja un archivo de más en la carpeta propia, no rompe la página.
    await this.client.storage.from(BUCKET).remove([path]);
  }
}
