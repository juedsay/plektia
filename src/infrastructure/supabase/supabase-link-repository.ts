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

type Client = SupabaseClient<Database>;
type LinkRow = Tables<"links">;
type SectionRow = Tables<"sections">;

const LINK_COLUMNS =
  "id, section_id, title, url, description, provider, provider_handle, tags, visible, position, version";
const SECTION_COLUMNS = "id, title, show_title, visible, position, version";

// SQLSTATE de la base (migración de links) → error del dominio.
const KNOWN_ERRORS: Readonly<Record<string, WriteError>> = {
  PL400: "invalid_input",
  PL404: "not_found",
  PL409: "conflict",
  PL429: "limit_reached",
  "42501": "forbidden", // RLS o privilegios
  "23514": "invalid_input", // check
  "23503": "not_found", // la sección se borró en el medio
  "23P01": "conflict", // posición repetida por una escritura simultánea
};

/**
 * Secciones y links con el cliente de la sesión: la RLS decide qué puede ver y
 * cambiar cada usuario (nunca la `service_role`). `ownerId` solo filtra las
 * lecturas, porque la RLS también devuelve lo público de otros.
 */
export class SupabaseLinkRepository implements LinkReader, LinkWriter, SectionWriter {
  constructor(
    private readonly client: Client,
    private readonly ownerId: string,
  ) {}

  async listOwn(): Promise<OwnLinks> {
    const [sections, links] = await Promise.all([
      this.client
        .from("sections")
        .select(SECTION_COLUMNS)
        .eq("owner_id", this.ownerId)
        .order("position"),
      this.client
        .from("links")
        .select(LINK_COLUMNS)
        .eq("owner_id", this.ownerId)
        .order("section_id", { nullsFirst: false })
        .order("position"),
    ]);
    if (sections.error) throw unexpected(sections.error);
    if (links.error) throw unexpected(links.error);
    return { sections: sections.data.map(toSection), links: links.data.map(toLink) };
  }

  async createLink(draft: LinkDraft): Promise<Result<Link, WriteError>> {
    const { data, error } = await this.client
      .from("links")
      .insert({
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
    return error ? fail(error) : ok(toLink(data));
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
    if (patch.provider !== undefined) changes.provider = patch.provider;
    if (patch.providerHandle !== undefined) changes.provider_handle = patch.providerHandle;

    const { data, error } = await this.client
      .from("links")
      .update(changes)
      .eq("id", id)
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
      target_section: sectionId,
      ids: items.map((item) => item.id),
      expected_versions: items.map((item) => item.version),
    } as unknown as Database["public"]["Functions"]["move_links"]["Args"];
    const { error } = await this.client.rpc("move_links", args);
    return error ? fail(error) : ok(undefined);
  }

  async createSection(draft: SectionDraft): Promise<Result<Section, WriteError>> {
    const { data, error } = await this.client
      .from("sections")
      .insert({ title: draft.title, show_title: draft.showTitle, visible: draft.visible })
      .select(SECTION_COLUMNS)
      .single();
    return error ? fail(error) : ok(toSection(data));
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
      .eq("version", version)
      .select("id");
    if (error) return fail(error);
    return data.length > 0 ? ok(undefined) : err(await this.missing("sections", id));
  }

  async reorderSections(items: readonly Versioned[]): Promise<Result<void, WriteError>> {
    const { error } = await this.client.rpc("reorder_sections", {
      ids: items.map((item) => item.id),
      expected_versions: items.map((item) => item.version),
    });
    return error ? fail(error) : ok(undefined);
  }

  /** Si no cambió ninguna fila: existe (y es mía) → conflicto de versión; si no, no existe. */
  private async missing(table: "links" | "sections", id: string): Promise<WriteError> {
    const { data, error } = await this.client
      .from(table)
      .select("id")
      .eq("id", id)
      .eq("owner_id", this.ownerId)
      .maybeSingle();
    if (error) throw unexpected(error);
    return data ? "conflict" : "not_found";
  }
}

function fail(error: PostgrestError): Result<never, WriteError> {
  const known = KNOWN_ERRORS[error.code];
  if (known) return err(known);
  throw unexpected(error);
}

function unexpected(error: PostgrestError): Error {
  return new Error(`links: error inesperado de la base (${error.code}): ${error.message}`);
}

function toLink(row: Omit<LinkRow, "owner_id" | "created_at" | "updated_at">): Link {
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
    position: row.position,
    version: row.version,
  };
}

function toSection(row: Omit<SectionRow, "owner_id" | "created_at" | "updated_at">): Section {
  return {
    id: row.id,
    title: row.title,
    showTitle: row.show_title,
    visible: row.visible,
    position: row.position,
    version: row.version,
  };
}
