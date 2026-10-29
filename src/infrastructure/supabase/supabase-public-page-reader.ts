import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  PublicPage,
  PublicPageReader,
  PublicProfileDirectory,
} from "@/application/ports/public-page-reader";
import type { Handle } from "@/domain/handle";
import { ACCENTS, COLOR_MODES } from "@/domain/page";
import { PROVIDERS } from "@/domain/provider";
import type { Database } from "@/infrastructure/supabase/database.types";

// Las columnas JSON de la vista no tienen tipo en TypeScript: se validan antes de
// llegar a la página. Si alguien rompe la forma de la vista, falla acá, claro,
// en vez de renderizar datos a medias.
const FeaturedSchema = z
  .object({
    videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
    kind: z.enum(["video", "short", "stream"]),
    title: z.string(),
    publishedAt: z.string(),
    durationSeconds: z.number().int().nonnegative().nullable(),
    mode: z.string(),
  })
  .transform(({ mode, ...featured }) => ({ ...featured, pinned: mode === "pinned" }));

const LiveSchema = z
  .object({
    title: z.string().nullable(),
    startedAt: z.string().nullable(),
    url: z.string().nullable(),
  })
  .transform(({ title, startedAt }) => ({ title, startedAt }));

const PublicLinkSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  url: z.string(),
  description: z.string().nullable(),
  provider: z.enum(PROVIDERS),
  providerHandle: z.string().nullable(),
  featured: FeaturedSchema.nullish().transform((featured) => featured ?? null),
  live: LiveSchema.nullish().transform((live) => live ?? null),
});

const RowSchema = z.object({
  handle: z.string(),
  display_name: z.string(),
  show_handle: z.boolean(),
  bio: z.string().nullable(),
  avatar_path: z.string().nullable(),
  theme: z.literal("tecnico"),
  color_mode: z.enum(COLOR_MODES),
  accent: z.enum(ACCENTS),
  sections: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      showTitle: z.boolean(),
      links: z.array(PublicLinkSchema),
    }),
  ),
  unsectioned_links: z.array(PublicLinkSchema),
});

/** Lee la vista `public_page_v` (una sola consulta por página). */
export class SupabasePublicPageReader implements PublicPageReader, PublicProfileDirectory {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getByHandle(handle: Handle): Promise<PublicPage | null> {
    const { data, error } = await this.client
      .from("public_page_v")
      .select(
        "handle, display_name, show_handle, bio, avatar_path, theme, color_mode, accent, sections, unsectioned_links",
      )
      .eq("handle", handle)
      .maybeSingle();
    if (error) throw new Error(`public-page: error de la base (${error.code}): ${error.message}`);
    if (!data) return null;

    const row = RowSchema.parse(data);
    return {
      handle: row.handle,
      displayName: row.display_name,
      showHandle: row.show_handle,
      bio: row.bio,
      avatarPath: row.avatar_path,
      theme: row.theme,
      colorMode: row.color_mode,
      accent: row.accent,
      sections: row.sections,
      unsectionedLinks: row.unsectioned_links,
    };
  }

  async listHandles(): Promise<string[]> {
    // De `pages` y no de la vista: no hace falta armar los links de cada una.
    // Como visitante, la RLS ya deja afuera las páginas de cuentas dadas de baja.
    const { data, error } = await this.client.from("pages").select("handle").order("handle");
    if (error) throw new Error(`public-page: error de la base (${error.code}): ${error.message}`);
    return data.map((row) => row.handle);
  }
}
