import type { SupabaseClient } from "@supabase/supabase-js";

import { avatarContentType } from "@/domain/avatar";
import type { Database } from "@/infrastructure/supabase/database.types";
import { SupabaseImageStorage } from "@/infrastructure/supabase/supabase-image-storage";

/** Avatares en el bucket `avatars` (`.webp` o `.jpg`, según la ruta). */
export class SupabaseAvatarStorage extends SupabaseImageStorage {
  constructor(client: SupabaseClient<Database>) {
    super(client, "avatars", avatarContentType);
  }
}
