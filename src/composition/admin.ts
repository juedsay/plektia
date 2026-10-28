import type { AvatarStorage } from "@/application/ports/avatar-storage";
import type { LinkReader, LinkWriter, SectionWriter } from "@/application/ports/link-repository";
import type { PageReader, PageWriter } from "@/application/ports/page-repository";
import {
  type CookieWriter,
  createSupabaseServerClient,
  type SupabaseConfig,
} from "@/infrastructure/supabase/server-client";
import { SupabaseAvatarStorage } from "@/infrastructure/supabase/supabase-avatar-storage";
import { SupabaseLinkRepository } from "@/infrastructure/supabase/supabase-link-repository";
import { SupabasePageRepository } from "@/infrastructure/supabase/supabase-page-repository";

export interface AdminRepositories {
  /** La cuenta de la sesión (su carpeta del bucket de avatares). */
  readonly ownerId: string;
  readonly pages: PageReader & PageWriter;
  /** Los avatares de la cuenta (su carpeta del bucket). */
  readonly avatars: AvatarStorage;
  /** Secciones y links de una página de la cuenta. */
  linksOf(pageId: string): LinkReader & LinkWriter & SectionWriter;
}

/**
 * Repositorios del panel para un pedido, con el cliente de la sesión del
 * usuario: la RLS decide qué puede leer y escribir (nunca la `service_role`).
 */
export function createAdminRepositories(
  config: SupabaseConfig,
  request: Request,
  cookies: CookieWriter,
  ownerId: string,
): AdminRepositories {
  const client = createSupabaseServerClient(config, request.headers.get("cookie"), cookies);
  return {
    ownerId,
    pages: new SupabasePageRepository(client, ownerId),
    avatars: new SupabaseAvatarStorage(client),
    linksOf: (pageId) => new SupabaseLinkRepository(client, pageId),
  };
}
