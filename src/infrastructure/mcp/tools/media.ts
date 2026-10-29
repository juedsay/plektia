import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getLinkMedia, setLinkMedia } from "@/application/links/link-media";
import { FEATURED_MODES } from "@/domain/link-media";
import { parsePageSettings } from "@/domain/page";
import type { McpWorkspace } from "@/infrastructure/mcp/workspace";
import {
  afterWrite,
  writingOn,
  done,
  failure,
  idArgument,
  pageArgument,
  readOnly,
  useCaseFailure,
} from "@/infrastructure/mcp/tools/shared";

// Contenido destacado, vigilancia en vivo, "Comprobar ahora" y el perfil.

export function registerMediaTools(server: McpServer, workspace: McpWorkspace): void {
  server.registerTool(
    "set_featured_content",
    {
      title: "Contenido destacado de YouTube",
      description:
        "Elige qué muestra el link de un canal de YouTube: el último video, el último short, " +
        "el último directo, uno fijado (pinnedVideo: URL o id del video) o nada.",
      inputSchema: {
        page: pageArgument,
        linkId: idArgument("del link del canal"),
        mode: z.enum(FEATURED_MODES),
        pinnedVideo: z.string().max(200).optional(),
      },
      annotations: { idempotentHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ page: handle, linkId, mode, pinnedVideo }) => {
      return writingOn(workspace, handle, async (page) => {
        const media = workspace.mediaOf(page.id);
        const current = await getLinkMedia({ media })({ linkId });
        if (!current.ok) return useCaseFailure(current.error);
        const saved = await setLinkMedia({ media })({
          linkId,
          watchLive: current.value.media.watchLive,
          featuredMode: mode,
          pinnedVideo,
        });
        return afterWrite(workspace, page, saved, "Contenido destacado actualizado.");
      });
    },
  );

  server.registerTool(
    "set_live_watch",
    {
      title: "Transmito en este canal",
      description:
        "Activa o desactiva que Plektia vigile si el canal (YouTube, Twitch o Kick) está en " +
        "vivo para mostrar el aviso en la página.",
      inputSchema: {
        page: pageArgument,
        linkId: idArgument("del link del canal"),
        watch: z.boolean(),
      },
      annotations: { idempotentHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ page: handle, linkId, watch }) => {
      return writingOn(workspace, handle, async (page) => {
        const media = workspace.mediaOf(page.id);
        const current = await getLinkMedia({ media })({ linkId });
        if (!current.ok) return useCaseFailure(current.error);
        const { featuredMode, pinnedVideoId } = current.value.media;
        const saved = await setLinkMedia({ media })({
          linkId,
          watchLive: watch,
          featuredMode,
          pinnedVideo: pinnedVideoId ?? undefined,
        });
        return afterWrite(
          workspace,
          page,
          saved,
          watch ? "Plektia vigila este canal." : "Plektia ya no vigila este canal.",
        );
      });
    },
  );

  server.registerTool(
    "check_live_now",
    {
      title: "Comprobar ahora",
      description:
        "Revisa ya si los canales vigilados de la cuenta están en vivo (como el botón del " +
        "panel). Una vez por minuto.",
      inputSchema: {},
      annotations: { destructiveHint: false, openWorldHint: true },
    },
    async () => {
      const blocked = readOnly(workspace);
      if (blocked) return blocked;
      const checked = await workspace.checkLive();
      if (checked.ok) return done(`Listo: se revisaron ${String(checked.value)} canales.`);
      return failure(
        checked.error === "rate_limited"
          ? "Ya se pidió hace menos de un minuto. Probá de nuevo en un rato."
          : "La revisión en vivo todavía no está configurada.",
      );
    },
  );

  server.registerTool(
    "update_profile",
    {
      title: "Nombre y bio",
      description:
        "Cambia el nombre visible y la bio de una página (el avatar y el tema se cambian " +
        "desde el panel). Una bio vacía la saca.",
      inputSchema: {
        page: pageArgument,
        displayName: z.string().max(200).optional().describe("Hasta 60 caracteres."),
        bio: z.string().max(400).optional().describe("Hasta 160 caracteres."),
      },
      annotations: { idempotentHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ page: handle, displayName, bio }) => {
      return writingOn(workspace, handle, async (page) => {
        // Las mismas reglas que el panel; tema y @handle quedan como están.
        const settings = parsePageSettings({
          displayName: displayName ?? page.displayName,
          bio: bio ?? page.bio ?? "",
          theme: page.theme,
          colorMode: page.colorMode,
          showHandle: page.showHandle,
        });
        if (!settings.ok) return useCaseFailure(settings.error);
        const updated = await workspace.updatePage(page.id, settings.value);
        return afterWrite(workspace, page, updated, "Perfil actualizado.");
      });
    },
  );
}
