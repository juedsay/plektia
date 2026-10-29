import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createSection } from "@/application/sections/create-section";
import { deleteSection } from "@/application/sections/delete-section";
import { reorderSections } from "@/application/sections/reorder-sections";
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

const sectionTitle = z.string().max(100).describe("Hasta 40 caracteres.");

export function registerSectionTools(server: McpServer, workspace: McpWorkspace): void {
  server.registerTool(
    "create_section",
    {
      title: "Crear una sección",
      description:
        "Agrega una sección al final de la página. Con requestId (un UUID que elegís vos), " +
        "repetir el pedido no la duplica.",
      inputSchema: {
        page: pageArgument,
        title: sectionTitle,
        showTitle: z.boolean().optional().describe("Si el título se ve en la página."),
        visible: z.boolean().optional(),
        requestId: z.uuid().optional(),
      },
      annotations: { destructiveHint: false, openWorldHint: false },
    },
    async ({ page: handle, requestId, ...fields }) => {
      return writingOn(workspace, handle, async (page) => {
        const created = await createSection({ sections: workspace.writerOf(page.id) })({
          ...fields,
          id: requestId,
        });
        return afterWrite(workspace, page, created, "Sección creada.", (section) => ({
          id: section.id,
          version: section.version,
        }));
      });
    },
  );

  server.registerTool(
    "update_section",
    {
      title: "Editar una sección",
      description: "Renombra una sección o muestra u oculta su título. Exige la versión leída.",
      inputSchema: {
        page: pageArgument,
        id: idArgument("de la sección"),
        version: versionArgument,
        title: sectionTitle.optional(),
        showTitle: z.boolean().optional(),
      },
      annotations: { idempotentHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ page: handle, id, version, ...changes }) => {
      return writingOn(workspace, handle, async (page) => {
        const updated = await updateSection({ sections: workspace.writerOf(page.id) })({
          id,
          version,
          changes,
        });
        return afterWrite(workspace, page, updated, "Sección actualizada.", (section) => ({
          id: section.id,
          version: section.version,
        }));
      });
    },
  );

  server.registerTool(
    "reorder_sections",
    {
      title: "Ordenar secciones",
      description: "Deja las secciones de la página en este orden (la lista completa).",
      inputSchema: { page: pageArgument, items: orderArgument },
      annotations: { idempotentHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ page: handle, items }) => {
      return writingOn(workspace, handle, async (page) => {
        const reordered = await reorderSections({ sections: workspace.writerOf(page.id) })({
          items,
        });
        return afterWrite(workspace, page, reordered, "Secciones ordenadas.");
      });
    },
  );

  server.registerTool(
    "delete_section",
    {
      title: "Borrar una sección",
      description:
        'Borra una sección; sus links pasan a "Sin sección" (no se borran). Exige ' +
        "confirm_title con el título exacto actual.",
      inputSchema: {
        page: pageArgument,
        id: idArgument("de la sección"),
        version: versionArgument,
        confirm_title: z.string().max(100).describe("El título exacto de la sección a borrar."),
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ page: handle, id, version, confirm_title: confirmTitle }) => {
      return writingOn(workspace, handle, async (page) => {
        const { sections } = await workspace.linksOf(page.id).listOwn();
        const section = sections.find((candidate) => candidate.id === id);
        if (section && section.title !== confirmTitle) {
          return failure(
            `No se borró: el título de la sección es "${section.title}" y confirm_title no coincide.`,
          );
        }
        const deleted = await deleteSection({
          sections: workspace.writerOf(page.id, confirmTitle),
        })({
          id,
          version,
        });
        return afterWrite(
          workspace,
          page,
          deleted,
          "Sección borrada; sus links quedaron sin sección.",
        );
      });
    },
  );
}
