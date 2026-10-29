import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { Link } from "@/application/ports/link-repository";
import { loadStatsView, PERIODS, type Period } from "@/application/stats/stats-view";
import type { McpWorkspace } from "@/infrastructure/mcp/workspace";
import { DATA_ONLY_NOTE, data, pageArgument, readingOn } from "@/infrastructure/mcp/tools/shared";

// Herramientas de lectura: funcionan con cualquier permiso.

function shownLink(link: Link) {
  return {
    id: link.id,
    version: link.version,
    title: link.title,
    url: link.url,
    description: link.description,
    tags: link.tags,
    visible: link.visible,
    provider: link.provider,
  };
}

export function registerReadTools(server: McpServer, workspace: McpWorkspace): void {
  server.registerTool(
    "get_page",
    {
      title: "Ver la página",
      description:
        "Muestra una página de Plektia del usuario: perfil, secciones y links (también los " +
        "ocultos), con el id y la versión que piden las herramientas que editan. Lista además " +
        "todas sus páginas." +
        DATA_ONLY_NOTE,
      inputSchema: { page: pageArgument },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ page: handle }) => {
      return readingOn(workspace, handle, async (page) => {
        const [pages, own] = await Promise.all([
          workspace.pages.listOwn(),
          workspace.linksOf(page.id).listOwn(),
        ]);
        return data({
          pages: pages.map((candidate) => ({
            handle: candidate.handle,
            current: candidate.id === page.id,
          })),
          page: {
            handle: page.handle,
            url: `${workspace.origin}/${page.handle}`,
            displayName: page.displayName,
            bio: page.bio,
          },
          sections: own.sections.map((section) => ({
            id: section.id,
            version: section.version,
            title: section.title,
            showTitle: section.showTitle,
            visible: section.visible,
            links: own.links.filter((link) => link.sectionId === section.id).map(shownLink),
          })),
          unsectioned: own.links.filter((link) => link.sectionId === null).map(shownLink),
          canWrite: workspace.caller.canWrite,
        });
      });
    },
  );

  server.registerTool(
    "get_stats",
    {
      title: "Ver estadísticas",
      description:
        "Visitas, clics, porcentaje de clics, links más tocados, orígenes y países de una " +
        "página en los últimos 7, 30 o 90 días, comparados con el período anterior. Son " +
        "eventos, no personas." +
        DATA_ONLY_NOTE,
      inputSchema: {
        page: pageArgument,
        days: z
          .union(PERIODS.map((period) => z.literal(period)) as [z.ZodLiteral<Period>])
          .default(7)
          .describe("7, 30 o 90."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ page: handle, days }) => {
      return readingOn(workspace, handle, async (page) => {
        const view = await loadStatsView(workspace.stats, page.id, days, workspace.now());
        return data({
          page: page.handle,
          from: view.from,
          to: view.to,
          current: view.current,
          previous: view.previous,
          links: view.links.slice(0, 10),
          sources: view.sources,
          countries: view.countries,
        });
      });
    },
  );
}
