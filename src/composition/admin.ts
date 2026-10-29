import type { AvatarStorage } from "@/application/ports/avatar-storage";
import type { LinkMediaRepository } from "@/application/ports/link-media-repository";
import type { LinkReader, LinkWriter, SectionWriter } from "@/application/ports/link-repository";
import type { PageReader, PageWriter } from "@/application/ports/page-repository";
import type { StatsReader } from "@/application/ports/stats-reader";
import type { UserDirectory } from "@/application/ports/user-directory";
import {
  type CookieWriter,
  createSupabaseServerClient,
  type SupabaseConfig,
} from "@/infrastructure/supabase/server-client";
import { SupabaseAvatarStorage } from "@/infrastructure/supabase/supabase-avatar-storage";
import { SupabaseLinkMediaRepository } from "@/infrastructure/supabase/supabase-link-media-repository";
import { SupabaseLinkRepository } from "@/infrastructure/supabase/supabase-link-repository";
import { SupabasePageRepository } from "@/infrastructure/supabase/supabase-page-repository";
import { SupabaseStatsReader } from "@/infrastructure/supabase/supabase-stats-reader";
import { SupabaseUserDirectory } from "@/infrastructure/supabase/supabase-user-directory";

export interface AdminRepositories {
  /** La cuenta de la sesión (su carpeta del bucket de avatares). */
  readonly ownerId: string;
  readonly pages: PageReader & PageWriter;
  /** Los avatares de la cuenta (su carpeta del bucket). */
  readonly avatars: AvatarStorage;
  /** Secciones y links de una página de la cuenta. */
  linksOf(pageId: string): LinkReader & LinkWriter & SectionWriter;
  /** "Transmito en este canal" y el contenido destacado de los links de una página. */
  mediaOf(pageId: string): LinkMediaRepository;
  /** La cuenta de la sesión y, si es owner, los usuarios habilitados. */
  readonly users: UserDirectory;
  /** Visitas y clics de las páginas de la cuenta (la RLS deja ver solo las propias). */
  readonly stats: StatsReader;
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
    mediaOf: (pageId) => new SupabaseLinkMediaRepository(client, pageId),
    users: new SupabaseUserDirectory(client, ownerId),
    stats: new SupabaseStatsReader(client),
  };
}
