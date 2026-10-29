import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { err, ok } from "@/domain/result";
import type { Database } from "@/infrastructure/supabase/database.types";
import {
  McpRpcLinkMedia,
  McpRpcLinkWriter,
  updatePageByMcp,
} from "@/infrastructure/supabase/mcp-rpc-writers";

// Los escritores de MCP solo traducen a las funciones `mcp_*` (que verifican
// grant, permiso y dueño en la base): qué argumentos mandan y cómo leen la
// respuesta. Contra la base real los prueba la integración.

const PAGE = "11111111-1111-4111-8111-111111111111";
const LINK = "c1000000-0000-4000-8000-000000000001";
const SECTION = "5e000000-0000-4000-8000-000000000001";

const linkRow = {
  id: LINK,
  section_id: null,
  title: "Blog",
  url: "https://ejemplo.com",
  description: null,
  provider: "generic",
  provider_handle: null,
  tags: [],
  visible: true,
  position: 0,
  version: 2,
};
const sectionRow = {
  id: SECTION,
  title: "Proyectos",
  show_title: true,
  visible: true,
  position: 0,
  version: 1,
};

function clientAnswering(data: unknown, error: { code: string; message: string } | null = null) {
  const rpc = vi.fn(() => Promise.resolve({ data, error }));
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc };
}

const forbidden = { code: "42501", message: "la conexión es de solo lectura" };

describe("escritores por funciones mcp_*", () => {
  it("crear un link manda el borrador completo y el id del pedido", async () => {
    const { client, rpc } = clientAnswering(linkRow);
    const result = await new McpRpcLinkWriter(client, PAGE).createLink(
      {
        title: "Blog",
        url: "https://ejemplo.com",
        description: null,
        tags: ["blog"],
        sectionId: null,
        visible: true,
        provider: "generic",
        providerHandle: null,
      },
      LINK,
    );
    expect(result).toMatchObject({ ok: true, value: { id: LINK, version: 2 } });
    expect(rpc).toHaveBeenCalledWith(
      "mcp_create_link",
      expect.objectContaining({
        p_page: PAGE,
        p_id: LINK,
        p_section: null,
        p_tags: ["blog"],
      }),
    );
  });

  it("editar manda solo las claves que cambian, con los nombres de la base", async () => {
    const { client, rpc } = clientAnswering(linkRow);
    await new McpRpcLinkWriter(client, PAGE).updateLink(LINK, 1, {
      title: "Otro",
      description: null,
      tags: ["a"],
      visible: false,
      url: "https://www.youtube.com/@canal",
      provider: "youtube",
      providerHandle: "@canal",
    });
    expect(rpc).toHaveBeenCalledWith("mcp_update_link", {
      p_page: PAGE,
      p_id: LINK,
      p_version: 1,
      p_changes: {
        title: "Otro",
        description: null,
        tags: ["a"],
        visible: false,
        url: "https://www.youtube.com/@canal",
        provider: "youtube",
        provider_handle: "@canal",
      },
    });
    await new McpRpcLinkWriter(client, PAGE).updateLink(LINK, 1, {});
    expect(rpc).toHaveBeenLastCalledWith(
      "mcp_update_link",
      expect.objectContaining({ p_changes: {} }),
    );
  });

  it("borrar lleva el título de confirmación; sin él, va null y la base no borra", async () => {
    const { client, rpc } = clientAnswering(null);
    await new McpRpcLinkWriter(client, PAGE, "Blog").deleteLink(LINK, 2);
    expect(rpc).toHaveBeenLastCalledWith(
      "mcp_delete_link",
      expect.objectContaining({ p_confirm_title: "Blog" }),
    );
    await new McpRpcLinkWriter(client, PAGE).deleteSection(SECTION, 1);
    expect(rpc).toHaveBeenLastCalledWith(
      "mcp_delete_section",
      expect.objectContaining({ p_confirm_title: null }),
    );
  });

  it("ordenar manda ids y versiones en paralelo", async () => {
    const { client, rpc } = clientAnswering(null);
    const writer = new McpRpcLinkWriter(client, PAGE);
    const items = [{ id: LINK, version: 2 }];
    expect(await writer.moveLinks(SECTION, items)).toEqual(ok(undefined));
    expect(rpc).toHaveBeenLastCalledWith("mcp_move_links", {
      p_page: PAGE,
      p_section: SECTION,
      p_ids: [LINK],
      p_versions: [2],
    });
    expect(await writer.reorderSections(items)).toEqual(ok(undefined));
  });

  it("secciones: crear y editar con los nombres de la base", async () => {
    const { client, rpc } = clientAnswering(sectionRow);
    const writer = new McpRpcLinkWriter(client, PAGE);
    const created = await writer.createSection({
      title: "Proyectos",
      showTitle: true,
      visible: true,
    });
    expect(created).toMatchObject({ ok: true, value: { id: SECTION, showTitle: true } });
    expect(rpc).toHaveBeenLastCalledWith(
      "mcp_create_section",
      expect.objectContaining({ p_id: null }),
    );
    await writer.updateSection(SECTION, 1, { title: "Videos", showTitle: false, visible: true });
    expect(rpc).toHaveBeenLastCalledWith(
      "mcp_update_section",
      expect.objectContaining({
        p_changes: { title: "Videos", show_title: false, visible: true },
      }),
    );
  });

  it("si la base rechaza (solo lectura, otro dueño), vuelve el error del dominio", async () => {
    const { client } = clientAnswering(null, forbidden);
    const writer = new McpRpcLinkWriter(client, PAGE, "Blog");
    const draft = {
      title: "x",
      url: "https://ejemplo.com",
      description: null,
      tags: [],
      sectionId: null,
      visible: true,
      provider: "generic" as const,
      providerHandle: null,
    };
    for (const attempt of [
      writer.createLink(draft),
      writer.updateLink(LINK, 1, { title: "x" }),
      writer.deleteLink(LINK, 1),
      writer.moveLinks(null, []),
      writer.createSection({ title: "x", showTitle: true, visible: true }),
      writer.updateSection(SECTION, 1, { title: "x" }),
      writer.deleteSection(SECTION, 1),
      writer.reorderSections([]),
    ]) {
      expect(await attempt).toEqual(err("forbidden"));
    }
  });

  it("medios: lee con el lector de siempre y guarda la configuración completa", async () => {
    const { client, rpc } = clientAnswering({
      watch_live: true,
      featured_mode: "latest_short",
      pinned_video_id: null,
    });
    const read = vi.fn(() => Promise.resolve(null));
    const media = new McpRpcLinkMedia(client, { read });
    expect(await media.read(LINK)).toBeNull();
    expect(read).toHaveBeenCalledWith(LINK);
    const saved = await media.save(LINK, {
      watchLive: true,
      featuredMode: "latest_short",
      pinnedVideoId: null,
    });
    expect(saved).toEqual(
      ok({ watchLive: true, featuredMode: "latest_short", pinnedVideoId: null }),
    );
    expect(rpc).toHaveBeenCalledWith("mcp_set_link_media", {
      p_link: LINK,
      p_changes: { watch_live: true, featured_mode: "latest_short", pinned_video_id: null },
    });

    const refused = new McpRpcLinkMedia(clientAnswering(null, forbidden).client, { read });
    expect(
      await refused.save(LINK, { watchLive: true, featuredMode: "none", pinnedVideoId: null }),
    ).toEqual(err("forbidden"));
  });

  it("página: solo nombre y bio", async () => {
    const pageRow = {
      id: PAGE,
      handle: "juedsay",
      display_name: "Nuevo",
      bio: null,
      theme: "tecnico",
      color_mode: "auto",
      accent: "hueso",
      link_shape: "rows",
      show_handle: true,
      avatar_path: null,
    };
    const { client, rpc } = clientAnswering(pageRow);
    const updated = await updatePageByMcp(client, PAGE, { displayName: "Nuevo", bio: null });
    expect(updated).toMatchObject({ ok: true, value: { handle: "juedsay", displayName: "Nuevo" } });
    expect(rpc).toHaveBeenCalledWith("mcp_update_page", {
      p_page: PAGE,
      p_changes: { display_name: "Nuevo", bio: null },
    });
    expect(
      await updatePageByMcp(clientAnswering(null, forbidden).client, PAGE, {
        displayName: "x",
        bio: null,
      }),
    ).toEqual(err("forbidden"));
  });
});
