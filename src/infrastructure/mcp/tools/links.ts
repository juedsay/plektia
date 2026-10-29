import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createLink } from "@/application/links/create-link";
import { deleteLink } from "@/application/links/delete-link";
import { moveLinks } from "@/application/links/move-links";
import { setLinkVisibility } from "@/application/links/set-link-visibility";
import { updateLink } from "@/application/links/update-link";
import { updateSection } from "@/application/sections/update-section";
import type { McpWorkspace } from "@/infrastructure/mcp/workspace";
import {
  afterWrite,
  writingOn,
  failure,
  idArgument,
  orderArgument,
  pageArgument,
  versionArgument,
} from "@/infrastructure/mcp/tools/shared";

// Herramientas de links (y la visibilidad de secciones): cada una llama al
// mismo caso de uso que el panel, con el escritor por funciones `mcp_*`.

const linkFields = {
  title: z.string().max(200).describe("Hasta 80 caracteres."),
  url: z.string().max(2048).describe("https://… o mailto:…"),
  description: z.string().max(400).nullable().optional().describe("Hasta 120 caracteres."),
  tags: z.array(z.string().max(40)).max(10).optional().describe("Hasta 5 etiquetas."),
};

export function registerLinkTools(server: McpServer, workspace: McpWorkspace): void {
  server.registerTool(
    "create_link",
    {
      title: "Crear un link",
      description:
        'Agrega un link a una sección o a "Sin sección" (sectionId null u omitido). Con ' +
        "requestId (un UUID que elegís vos), repetir el pedido no lo duplica.",
      inputSchema: {
        page: pageArgument,
        ...linkFields,
        sectionId: z.uuid().nullable().optional().describe("La sección (de get_page)."),
        visible: z.boolean().optional(),
        requestId: z.uuid().optional().describe("Para que repetir el pedido no lo duplique."),
      },
      annotations: { destructiveHint: false, openWorldHint: false },
    },
    async ({ page: handle, requestId, ...fields }) => {
      return writingOn(workspace, handle, async (page) => {
        const created = await createLink({ links: workspace.writerOf(page.id) })({
          ...fields,
          id: requestId,
        });
        return afterWrite(workspace, page, created, "Link creado.", (link) => ({
          id: link.id,
          version: link.version,
        }));
      });
    },
  );

  server.registerTool(
    "update_link",
    {
      title: "Editar un link",
      description:
        "Cambia el título, la URL, la descripción o las etiquetas de un link. Exige la " +
        "versión leída con get_page.",
      inputSchema: {
        page: pageArgument,
        id: idArgument("del link"),
        version: versionArgument,
        title: linkFields.title.optional(),
        url: linkFields.url.optional(),
        description: linkFields.description,
        tags: linkFields.tags,
      },
      annotations: { idempotentHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ page: handle, id, version, ...changes }) => {
      return writingOn(workspace, handle, async (page) => {
        const updated = await updateLink({ links: workspace.writerOf(page.id) })({
          id,
          version,
          changes,
        });
        return afterWrite(workspace, page, updated, "Link actualizado.", (link) => ({
          id: link.id,
          version: link.version,
        }));
      });
    },
  );

  server.registerTool(
    "set_visibility",
    {
      title: "Ocultar o mostrar",
      description: "Oculta o muestra un link o una sección entera en la página pública.",
      inputSchema: {
        page: pageArgument,
        kind: z.enum(["link", "section"]),
        id: idArgument("del link o la sección"),
        version: versionArgument,
        visible: z.boolean(),
      },
      annotations: { idempotentHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ page: handle, kind, id, version, visible }) => {
      return writingOn(workspace, handle, async (page) => {
        const writer = workspace.writerOf(page.id);
        const message = visible ? "Ahora se ve." : "Ahora está oculto.";
        if (kind === "link") {
          const result = await setLinkVisibility({ links: writer })({ id, version, visible });
          return afterWrite(workspace, page, result, message);
        }
        const result = await updateSection({ sections: writer })({
          id,
          version,
          changes: { visible },
        });
        return afterWrite(workspace, page, result, message);
      });
    },
  );

  server.registerTool(
    "move_links",
    {
      title: "Ordenar o mover links",
      description:
        'Deja una sección (o "Sin sección" con sectionId null) con exactamente estos links ' +
        "en este orden. Trae los que estén en otro lado; los que ya estaban tienen que venir " +
        "en la lista.",
      inputSchema: {
        page: pageArgument,
        sectionId: z.uuid().nullable(),
        items: orderArgument,
      },
      annotations: { destructiveHint: false, openWorldHint: false },
    },
    async ({ page: handle, sectionId, items }) => {
      return writingOn(workspace, handle, async (page) => {
        const moved = await moveLinks({ links: workspace.writerOf(page.id) })({ sectionId, items });
        return afterWrite(workspace, page, moved, "Links ordenados.");
      });
    },
  );

  server.registerTool(
    "delete_link",
    {
      title: "Borrar un link",
      description:
        "Borra un link para siempre. Exige confirm_title con el título exacto actual: si el " +
        "pedido es ambiguo, preguntale al usuario antes.",
      inputSchema: {
        page: pageArgument,
        id: idArgument("del link"),
        version: versionArgument,
        confirm_title: z.string().max(200).describe("El título exacto del link a borrar."),
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ page: handle, id, version, confirm_title: confirmTitle }) => {
      return writingOn(workspace, handle, async (page) => {
        const { links } = await workspace.linksOf(page.id).listOwn();
        const link = links.find((candidate) => candidate.id === id);
        if (link && link.title !== confirmTitle) {
          return failure(
            `No se borró: el título del link es "${link.title}" y confirm_title no coincide.`,
          );
        }
        const deleted = await deleteLink({ links: workspace.writerOf(page.id, confirmTitle) })({
          id,
          version,
        });
        return afterWrite(workspace, page, deleted, "Link borrado.");
      });
    },
  );
}
