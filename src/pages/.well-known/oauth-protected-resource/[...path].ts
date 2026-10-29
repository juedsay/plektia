import type { APIRoute } from "astro";

import { mcpAuthorizationServerUrl } from "@/composition/runtime";
import { protectedResourceMetadata } from "@/infrastructure/mcp/resource-metadata";

// RFC 9728: el cliente lo busca en la raíz o con la ruta del recurso
// (`/.well-known/oauth-protected-resource/mcp`). Cualquier otra ruta, 404.
export const GET: APIRoute = ({ params, url }) => {
  if (params.path !== undefined && params.path !== "mcp") {
    return new Response(null, { status: 404 });
  }
  const metadata = protectedResourceMetadata(url.origin, mcpAuthorizationServerUrl());
  return new Response(JSON.stringify(metadata), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      // Los clientes MCP que corren en un navegador también lo leen.
      "Access-Control-Allow-Origin": "*",
    },
  });
};
