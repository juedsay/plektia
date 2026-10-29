import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type {
  Link,
  LinkReader,
  LinkWriter,
  OwnLinks,
  Section,
  SectionWriter,
  Versioned,
  WriteError,
} from "@/application/ports/link-repository";
import type { LinkDraft, LinkPatch } from "@/domain/link";
import { err, ok, type Result } from "@/domain/result";
import type { SectionDraft, SectionPatch } from "@/domain/section";
import type { Database, Tables, TablesUpdate } from "@/infrastructure/supabase/database.types";
import { unexpectedDatabaseError, writeFailure } from "@/infrastructure/supabase/write-errors";

type Client = SupabaseClient<Database>;
type LinkRow = Tables<"links">;
type SectionRow = Tables<"sections">;

const LINK_COLUMNS =
  "id, section_id, title, url, description, provider, provider_handle, tags, visible, placement, highlight, position, version";
const SECTION_COLUMNS = "id, title, show_title, visible, position, version";

/**
 * Secciones y links de una página, con el cliente de la sesión: la RLS decide
 * qué puede ver y cambiar cada usuario (nunca la `service_role`). `pageId` es
 * la página sobre la que se trabaja (SPEC-pages); en una página ajena la RLS
 * solo deja leer lo público y la base rechaza las escrituras.
 */
export class SupabaseLinkRepository implements LinkReader, LinkWriter, SectionWriter {
  constructor(
    private readonly client: Client,
    private readonly pageId: string,
  ) {}

  async listOwn(): Promise<OwnLinks> {
    const [sections, links] = await Promise.all([
      this.client
        .from("sections")
        .select(SECTION_COLUMNS)
        .eq("page_id", this.pageId)
        .order("position"),
      this.client
        .from("links")
        .select(LINK_COLUMNS)
        .eq("page_id", this.pageId)
        .order("section_id", { nullsFirst: false })
        .order("position"),
    ]);
    if (sections.error) throw unexpected(sections.error);
    if (links.error) throw unexpected(links.error);
    return { sections: sections.data.map(toSection), links: links.data.map(toLink) };
  }

  async createLink(draft: LinkDraft, id?: string): Promise<Result<Link, WriteError>> {
    const { data, error } = await this.client
      .from("links")
      .insert({
        ...(id === undefined ? {} : { id }),
        page_id: this.pageId,
        section_id: draft.sectionId,
        title: draft.title,
        url: draft.url,
        description: draft.description,
        provider: draft.provider,
        provider_handle: draft.providerHandle,
        tags: [...draft.tags],
        visible: draft.visible,
      })
      .select(LINK_COLUMNS)
      .single();
    if (!error) return ok(toLink(data));
    // El mismo pedido otra vez: el link ya existe con ese id (en esta página).
    if (id !== undefined) {
      const existing = await this.client
        .from("links")
        .select(LINK_COLUMNS)
        .eq("id", id)
        .eq("page_id", this.pageId)
        .maybeSingle();
      if (existing.error) throw unexpected(existing.error);
      if (existing.data) return ok(toLink(existing.data));
    }
    return fail(error);
  }

  async updateLink(
    id: string,
    version: number,
    patch: LinkPatch,
  ): Promise<Result<Link, WriteError>> {
    const changes: TablesUpdate<"links"> = {};
    if (patch.title !== undefined) changes.title = patch.title;
    if (patch.url !== undefined) changes.url = patch.url;
    if (patch.description !== undefined) changes.description = patch.description;
    if (patch.tags !== undefined) changes.tags = [...patch.tags];
    if (patch.visible !== undefined) changes.visible = patch.visible;
    if (patch.placement !== undefined) changes.placement = patch.placement;
    if (patch.highlight !== undefined) changes.highlight = patch.highlight;
    if (patch.provider !== undefined) changes.provider = patch.provider;
    if (patch.providerHandle !== undefined) changes.provider_handle = patch.providerHandle;

    const { data, error } = await this.client
      .from("links")
      .update(changes)
      .eq("id", id)
      .eq("page_id", this.pageId)
      .eq("version", version)
      .select(LINK_COLUMNS);
    if (error) return fail(error);
    const [row] = data;
    return row ? ok(toLink(row)) : err(await this.missing("links", id));
  }

  async deleteLink(id: string, version: number): Promise<Result<void, WriteError>> {
    const { data, error } = await this.client
      .from("links")
      .delete()
      .eq("id", id)
      .eq("page_id", this.pageId)
      .eq("version", version)
      .select("id");
    if (error) return fail(error);
    return data.length > 0 ? ok(undefined) : err(await this.missing("links", id));
  }

  async moveLinks(
    sectionId: string | null,
    items: readonly Versioned[],
  ): Promise<Result<void, WriteError>> {
    // La RPC acepta `null` en `target_section` ("Sin sección"), pero el generador de
    // tipos declara los parámetros de una función como no nulos.
    const args = {
      target_page: this.pageId,
      target_section: sectionId,
      ids: items.map((item) => item.id),
      expected_versions: items.map((item) => item.version),
    } as unknown as Database["public"]["Functions"]["move_links"]["Args"];
    const { error } = await this.client.rpc("move_links", args);
    return error ? fail(error) : ok(undefined);
  }

  async createSection(draft: SectionDraft, id?: string): Promise<Result<Section, WriteError>> {
    const { data, error } = await this.client
      .from("sections")
      .insert({
        ...(id === undefined ? {} : { id }),
        page_id: this.pageId,
        title: draft.title,
        show_title: draft.showTitle,
        visible: draft.visible,
      })
      .select(SECTION_COLUMNS)
      .single();
    if (!error) return ok(toSection(data));
    // El mismo pedido otra vez: la sección ya existe con ese id (en esta página).
    if (id !== undefined) {
      const existing = await this.client
        .from("sections")
        .select(SECTION_COLUMNS)
        .eq("id", id)
        .eq("page_id", this.pageId)
        .maybeSingle();
      if (existing.error) throw unexpected(existing.error);
      if (existing.data) return ok(toSection(existing.data));
    }
    return fail(error);
  }

  async updateSection(
    id: string,
    version: number,
    patch: SectionPatch,
  ): Promise<Result<Section, WriteError>> {
    const changes: TablesUpdate<"sections"> = {};
    if (patch.title !== undefined) changes.title = patch.title;
    if (patch.showTitle !== undefined) changes.show_title = patch.showTitle;
    if (patch.visible !== undefined) changes.visible = patch.visible;

    const { data, error } = await this.client
      .from("sections")
      .update(changes)
      .eq("id", id)
      .eq("page_id", this.pageId)
      .eq("version", version)
      .select(SECTION_COLUMNS);
    if (error) return fail(error);
    const [row] = data;
    return row ? ok(toSection(row)) : err(await this.missing("sections", id));
  }

  async deleteSection(id: string, version: number): Promise<Result<void, WriteError>> {
    const { data, error } = await this.client
      .from("sections")
      .delete()
      .eq("id", id)
      .eq("page_id", this.pageId)
      .eq("version", version)
      .select("id");
    if (error) return fail(error);
    return data.length > 0 ? ok(undefined) : err(await this.missing("sections", id));
  }

  async reorderSections(items: readonly Versioned[]): Promise<Result<void, WriteError>> {
    const { error } = await this.client.rpc("reorder_sections", {
      target_page: this.pageId,
      ids: items.map((item) => item.id),
      expected_versions: items.map((item) => item.version),
    });
    return error ? fail(error) : ok(undefined);
  }

  /** Si no cambió ninguna fila: existe (en esta página) → conflicto de versión; si no, no existe. */
  private async missing(table: "links" | "sections", id: string): Promise<WriteError> {
    const { data, error } = await this.client
      .from(table)
      .select("id")
      .eq("id", id)
      .eq("page_id", this.pageId)
      .maybeSingle();
    if (error) throw unexpected(error);
    return data ? "conflict" : "not_found";
  }
}

function fail(error: PostgrestError): Result<never, WriteError> {
  return writeFailure("links", error);
}

function unexpected(error: PostgrestError): Error {
  return unexpectedDatabaseError("links", error);
}

export function toLink(
  row: Omit<LinkRow, "owner_id" | "page_id" | "created_at" | "updated_at">,
): Link {
  return {
    id: row.id,
    sectionId: row.section_id,
    title: row.title,
    url: row.url,
    description: row.description,
    provider: row.provider,
    providerHandle: row.provider_handle,
    tags: row.tags,
    visible: row.visible,
    placement: row.placement,
    highlight: row.highlight,
    position: row.position,
    version: row.version,
  };
}

export function toSection(
  row: Omit<SectionRow, "owner_id" | "page_id" | "created_at" | "updated_at">,
): Section {
  return {
    id: row.id,
    title: row.title,
    showTitle: row.show_title,
    visible: row.visible,
    position: row.position,
    version: row.version,
  };
}
