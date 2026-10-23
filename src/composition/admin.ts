import type { LinkReader } from "@/application/ports/link-repository";
import type { PageReader, PageWriter } from "@/application/ports/page-repository";
import {
  type CookieWriter,
  createSupabaseServerClient,
  type SupabaseConfig,
} from "@/infrastructure/supabase/server-client";
import { SupabaseLinkRepository } from "@/infrastructure/supabase/supabase-link-repository";
import { SupabasePageRepository } from "@/infrastructure/supabase/supabase-page-repository";

export interface AdminRepositories {
  readonly pages: PageReader & PageWriter;
  /** Secciones y links de una página de la cuenta. */
  linksOf(pageId: string): LinkReader;
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
    pages: new SupabasePageRepository(client, ownerId),
    linksOf: (pageId) => new SupabaseLinkRepository(client, pageId),
  };
}
