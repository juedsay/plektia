import type { SupabaseClient } from "@supabase/supabase-js";

import type { WriteError } from "@/application/ports/link-repository";
import type {
  Page,
  PageReader,
  PageWriteError,
  PageWriter,
} from "@/application/ports/page-repository";
import type { PageDraft, PageSettings } from "@/domain/page";
import { err, ok, type Result } from "@/domain/result";
import type { Database, Tables } from "@/infrastructure/supabase/database.types";
import { unexpectedDatabaseError, writeFailure } from "@/infrastructure/supabase/write-errors";

type Client = SupabaseClient<Database>;
type PageRow = Pick<
  Tables<"pages">,
  | "id"
  | "handle"
  | "display_name"
  | "bio"
  | "theme"
  | "color_mode"
  | "accent"
  | "show_handle"
  | "avatar_path"
>;

const PAGE_COLUMNS =
  "id, handle, display_name, bio, theme, color_mode, accent, show_handle, avatar_path";
const UNIQUE_VIOLATION = "23505";

/**
 * Páginas de la cuenta de la sesión (SPEC-pages), con el cliente de la sesión:
 * la RLS y los triggers deciden (dueño, cuenta activa, límite de 3). `ownerId`
 * solo filtra las lecturas, porque la RLS también devuelve las páginas públicas
 * de otros.
 */
export class SupabasePageRepository implements PageReader, PageWriter {
  constructor(
    private readonly client: Client,
    private readonly ownerId: string,
  ) {}

  async listOwn(): Promise<readonly Page[]> {
    const { data, error } = await this.client
      .from("pages")
      .select(PAGE_COLUMNS)
      .eq("owner_id", this.ownerId)
      .order("created_at")
      .order("id");
    if (error) throw unexpectedDatabaseError("pages", error);
    return data.map(toPage);
  }

  async lastUsedPageId(): Promise<string | null> {
    const { data, error } = await this.client
      .from("profiles")
      .select("last_page_id")
      .eq("id", this.ownerId)
      .maybeSingle();
    if (error) throw unexpectedDatabaseError("pages", error);
    return data?.last_page_id ?? null;
  }

  async createPage(draft: PageDraft, id?: string): Promise<Result<Page, PageWriteError>> {
    const { data, error } = await this.client
      .from("pages")
      .insert({
        ...(id === undefined ? {} : { id }),
        handle: draft.handle,
        display_name: draft.displayName,
      })
      .select(PAGE_COLUMNS)
      .single();
    if (error?.code === UNIQUE_VIOLATION) return err("handle_taken");
    return error ? writeFailure("pages", error) : ok(toPage(data));
  }

  async updatePageSettings(
    pageId: string,
    settings: PageSettings,
  ): Promise<Result<Page, WriteError>> {
    const { data, error } = await this.client
      .from("pages")
      .update({
        display_name: settings.displayName,
        bio: settings.bio,
        theme: settings.theme,
        color_mode: settings.colorMode,
        accent: settings.accent,
        show_handle: settings.showHandle,
      })
      .eq("id", pageId)
      .eq("owner_id", this.ownerId)
      .select(PAGE_COLUMNS);
    if (error) return writeFailure("pages", error);
    const [row] = data;
    // Sin filas: no es una página propia (o la RLS no dejó editarla).
    return row ? ok(toPage(row)) : err("not_found");
  }

  async setAvatar(pageId: string, avatarPath: string | null): Promise<Result<Page, WriteError>> {
    const { data, error } = await this.client
      .from("pages")
      .update({ avatar_path: avatarPath })
      .eq("id", pageId)
      .eq("owner_id", this.ownerId)
      .select(PAGE_COLUMNS);
    if (error) return writeFailure("pages", error);
    const [row] = data;
    return row ? ok(toPage(row)) : err("not_found");
  }

  async rememberLastPage(pageId: string): Promise<Result<void, WriteError>> {
    const { data, error } = await this.client
      .from("profiles")
      .update({ last_page_id: pageId })
      .eq("id", this.ownerId)
      .select("id");
    if (error) return writeFailure("pages", error);
    // Sin filas: la RLS no dejó editar el perfil (por ejemplo, una cuenta dada de baja).
    return data.length > 0 ? ok(undefined) : err("forbidden");
  }
}

export function toPage(row: PageRow): Page {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    theme: row.theme,
    colorMode: row.color_mode,
    accent: row.accent,
    showHandle: row.show_handle,
    avatarPath: row.avatar_path,
  };
}
