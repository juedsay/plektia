import type { ImageStorage } from "@/application/ports/image-storage";

/** Archivos de avatar (Supabase Storage, bucket `avatars`), con la sesión de quien sube. */
export type AvatarStorage = ImageStorage;
