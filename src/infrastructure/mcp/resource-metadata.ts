// Metadatos del recurso protegido (RFC 9728, SPEC-mcp-server): le dicen al
// cliente MCP que `/mcp` se protege con OAuth y que el servidor de
// autorización es el de Supabase Auth. Puros: la ruta pone el origen y la URL.

export interface ProtectedResourceMetadata {
  readonly resource: string;
  readonly authorization_servers: readonly string[];
  readonly bearer_methods_supported: readonly string[];
  readonly resource_name: string;
}

export function mcpResourceUrl(origin: string): string {
  return `${origin}/mcp`;
}

export function protectedResourceMetadata(
  origin: string,
  supabaseUrl: string,
): ProtectedResourceMetadata {
  return {
    resource: mcpResourceUrl(origin),
    authorization_servers: [`${supabaseUrl.replace(/\/$/, "")}/auth/v1`],
    bearer_methods_supported: ["header"],
    resource_name: "Plektia",
  };
}

/** `/.well-known/oauth-protected-resource` y su variante con la ruta del recurso (`/mcp`). */
export function resourceMetadataUrl(origin: string): string {
  return `${origin}/.well-known/oauth-protected-resource`;
}

/** La cabecera del 401 de `/mcp`: dónde están los metadatos para autenticarse. */
export function wwwAuthenticate(origin: string): string {
  return `Bearer resource_metadata="${resourceMetadataUrl(origin)}"`;
}
