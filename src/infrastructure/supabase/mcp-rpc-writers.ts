import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { LinkMediaRepository, LinkMediaView } from "@/application/ports/link-media-repository";
import type {
  Link,
  LinkWriter,
  Section,
  SectionWriter,
  Versioned,
  WriteError,
} from "@/application/ports/link-repository";
import type { Page } from "@/application/ports/page-repository";
import type { LinkDraft, LinkPatch } from "@/domain/link";
import type { LinkMedia } from "@/domain/link-media";
import type { PageSettings } from "@/domain/page";
import { ok, type Result } from "@/domain/result";
import type { SectionDraft, SectionPatch } from "@/domain/section";
import type { Database, Json } from "@/infrastructure/supabase/database.types";
import { toMedia } from "@/infrastructure/supabase/supabase-link-media-repository";
import { toLink, toSection } from "@/infrastructure/supabase/supabase-link-repository";
import { toPage } from "@/infrastructure/supabase/supabase-page-repository";
import { writeFailure } from "@/infrastructure/supabase/write-errors";

// Escrituras de los clientes MCP (SPEC-mcp-server): las mismas operaciones que
// el panel, pero por las funciones `mcp_*`, porque la RLS no deja escribir
// directo con un token que trae `client_id`. Cada función vuelve a verificar
// el grant, el permiso de escritura y el dueño, y deja la auditoría.

type Client = SupabaseClient<Database>;
type Functions = Database["public"]["Functions"];

// Los generadores de tipos declaran no nulos todos los parámetros de una
// función; las `mcp_*` aceptan `null` donde el dominio lo usa ("Sin sección",
// sin descripción, alta sin id): de ahí los `as … ["Args"]`.

function fail(error: PostgrestError): Result<never, WriteError> {
  return writeFailure("mcp", error);
}

/** Links y secciones de una página, por las funciones `mcp_*`. */
export class McpRpcLinkWriter implements LinkWriter, SectionWriter {
  /**
   * `confirmTitle`: el título exacto que el agente repitió para borrar. Sin él,
   * la base no borra (el borrado exige confirmación también ahí).
   */
  constructor(
    private readonly client: Client,
    private readonly pageId: string,
    private readonly confirmTitle: string | null = null,
  ) {}

  async createLink(draft: LinkDraft, id?: string): Promise<Result<Link, WriteError>> {
    const { data, error } = await this.client.rpc("mcp_create_link", {
      p_page: this.pageId,
      p_id: id ?? null,
      p_section: draft.sectionId,
      p_title: draft.title,
      p_url: draft.url,
      p_description: draft.description,
      p_provider: draft.provider,
      p_provider_handle: draft.providerHandle,
      p_tags: [...draft.tags],
      p_visible: draft.visible,
      p_kind: draft.kind,
    } as Functions["mcp_create_link"]["Args"]);
    return error ? fail(error) : ok(toLink(data));
  }

  async updateLink(
    id: string,
    version: number,
    patch: LinkPatch,
  ): Promise<Result<Link, WriteError>> {
    const changes: Record<string, Json> = {};
    if (patch.title !== undefined) changes["title"] = patch.title;
    if (patch.url !== undefined) changes["url"] = patch.url;
    if (patch.description !== undefined) changes["description"] = patch.description;
    if (patch.tags !== undefined) changes["tags"] = [...patch.tags];
    if (patch.visible !== undefined) changes["visible"] = patch.visible;
    if (patch.provider !== undefined) changes["provider"] = patch.provider;
    if (patch.providerHandle !== undefined) changes["provider_handle"] = patch.providerHandle;
    if (patch.kind !== undefined) changes["kind"] = patch.kind;
    const { data, error } = await this.client.rpc("mcp_update_link", {
      p_page: this.pageId,
      p_id: id,
      p_version: version,
      p_changes: changes,
    });
    return error ? fail(error) : ok(toLink(data));
  }

  async deleteLink(id: string, version: number): Promise<Result<void, WriteError>> {
    const { error } = await this.client.rpc("mcp_delete_link", {
      p_page: this.pageId,
      p_id: id,
      p_version: version,
      p_confirm_title: this.confirmTitle,
    } as Functions["mcp_delete_link"]["Args"]);
    return error ? fail(error) : ok(undefined);
  }

  async moveLinks(
    sectionId: string | null,
    items: readonly Versioned[],
  ): Promise<Result<void, WriteError>> {
    const { error } = await this.client.rpc("mcp_move_links", {
      p_page: this.pageId,
      p_section: sectionId,
      p_ids: items.map((item) => item.id),
      p_versions: items.map((item) => item.version),
    } as Functions["mcp_move_links"]["Args"]);
    return error ? fail(error) : ok(undefined);
  }

  async createSection(draft: SectionDraft, id?: string): Promise<Result<Section, WriteError>> {
    const { data, error } = await this.client.rpc("mcp_create_section", {
      p_page: this.pageId,
      p_id: id ?? null,
      p_title: draft.title,
      p_show_title: draft.showTitle,
      p_visible: draft.visible,
    } as Functions["mcp_create_section"]["Args"]);
    return error ? fail(error) : ok(toSection(data));
  }

  async updateSection(
    id: string,
    version: number,
    patch: SectionPatch,
  ): Promise<Result<Section, WriteError>> {
    const changes: Record<string, Json> = {};
    if (patch.title !== undefined) changes["title"] = patch.title;
    if (patch.showTitle !== undefined) changes["show_title"] = patch.showTitle;
    if (patch.visible !== undefined) changes["visible"] = patch.visible;
    const { data, error } = await this.client.rpc("mcp_update_section", {
      p_page: this.pageId,
      p_id: id,
      p_version: version,
      p_changes: changes,
    });
    return error ? fail(error) : ok(toSection(data));
  }

  async deleteSection(id: string, version: number): Promise<Result<void, WriteError>> {
    const { error } = await this.client.rpc("mcp_delete_section", {
      p_page: this.pageId,
      p_id: id,
      p_version: version,
      p_confirm_title: this.confirmTitle,
    } as Functions["mcp_delete_section"]["Args"]);
    return error ? fail(error) : ok(undefined);
  }

  async reorderSections(items: readonly Versioned[]): Promise<Result<void, WriteError>> {
    const { error } = await this.client.rpc("mcp_reorder_sections", {
      p_page: this.pageId,
      p_ids: items.map((item) => item.id),
      p_versions: items.map((item) => item.version),
    });
    return error ? fail(error) : ok(undefined);
  }
}

/** Medios de un link: se leen como siempre (RLS) y se guardan por `mcp_set_link_media`. */
export class McpRpcLinkMedia implements LinkMediaRepository {
  constructor(
    private readonly client: Client,
    private readonly reader: Pick<LinkMediaRepository, "read">,
  ) {}

  read(linkId: string): Promise<LinkMediaView | null> {
    return this.reader.read(linkId);
  }

  async save(linkId: string, media: LinkMedia): Promise<Result<LinkMedia, WriteError>> {
    const { data, error } = await this.client.rpc("mcp_set_link_media", {
      p_link: linkId,
      p_changes: {
        watch_live: media.watchLive,
        featured_mode: media.featuredMode,
        pinned_video_id: media.pinnedVideoId,
      },
    });
    return error ? fail(error) : ok(toMedia(data));
  }
}

/** Nombre visible y bio de una página (el tema y el @handle no se cambian por MCP). */
export async function updatePageByMcp(
  client: Client,
  pageId: string,
  settings: Pick<PageSettings, "displayName" | "bio">,
): Promise<Result<Page, WriteError>> {
  const { data, error } = await client.rpc("mcp_update_page", {
    p_page: pageId,
    p_changes: { display_name: settings.displayName, bio: settings.bio },
  });
  return error ? fail(error) : ok(toPage(data));
}
