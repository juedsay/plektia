import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { APIRoute } from "astro";

import { mcpRateLimiter, mcpTokenVerifier, mcpWorkspaceFor } from "@/composition/runtime";
import { DEFAULT_BODY_LIMIT } from "@/infrastructure/http/request-limits";
import { bearerToken, mcpHeaders } from "@/infrastructure/mcp/http";
import { wwwAuthenticate } from "@/infrastructure/mcp/resource-metadata";
import { createMcpServer } from "@/infrastructure/mcp/server";

// Servidor MCP (SPEC-mcp-server): Streamable HTTP sin estado, un servidor por
// pedido. Sin cookies: la identidad es solo el Bearer de OAuth, verificado en
// cada llamada (firma, emisor, `client_id` y grant activo).

function jsonError(status: number, message: string, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...mcpHeaders(), "Content-Type": "application/json", ...extra },
  });
}

/**
 * Rechazar sin usar el cuerpo, pero leyéndolo entero (el middleware ya lo
 * limita a 64 KB): si queda sin leer, la conexión no se puede reusar para el
 * pedido siguiente.
 */
async function reject(request: Request, response: Response): Promise<Response> {
  await request.arrayBuffer().catch(() => undefined);
  return response;
}

export const POST: APIRoute = async ({ request, url }) => {
  const token = bearerToken(request.headers.get("authorization"));
  const caller = token === null ? null : await mcpTokenVerifier().verify(token);
  if (!caller) {
    return reject(
      request,
      jsonError(401, "Se necesita autorización.", {
        "WWW-Authenticate": wwwAuthenticate(url.origin),
      }),
    );
  }
  if (!(await mcpRateLimiter().allow(`mcp:${caller.userId}:${caller.clientId}`))) {
    return reject(
      request,
      jsonError(429, "Demasiadas llamadas seguidas. Esperá un minuto.", { "Retry-After": "60" }),
    );
  }

  const server = createMcpServer(mcpWorkspaceFor(caller, url.origin));
  // Sin `sessionIdGenerator`: modo sin estado (no hay sesión entre pedidos).
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    maxRequestBodySize: DEFAULT_BODY_LIMIT,
  });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(mcpHeaders())) headers.set(name, value);
    return new Response(response.body, { status: response.status, headers });
  } finally {
    await server.close();
  }
};

// Sin sesiones ni notificaciones del servidor: no hay stream que abrir ni cerrar.
const notAllowed: APIRoute = () =>
  new Response(null, { status: 405, headers: { ...mcpHeaders(), Allow: "POST, OPTIONS" } });
export const GET = notAllowed;
export const DELETE = notAllowed;

export const OPTIONS: APIRoute = () => new Response(null, { status: 204, headers: mcpHeaders() });
