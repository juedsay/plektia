// HTTP de `/mcp` (reglas puras): el Bearer y las cabeceras de cada respuesta.

/** El token de `Authorization: Bearer …`, o `null` si no viene bien formado. */
export function bearerToken(header: string | null): string | null {
  const match = /^Bearer ([\w.~+/-]+=*)$/i.exec(header?.trim() ?? "");
  return match?.[1] ?? null;
}

/**
 * Nunca se cachea. CORS abierto pero acotado al protocolo: la identidad es el
 * Bearer, no hay cookies que un sitio ajeno pueda aprovechar.
 */
export function mcpHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
    "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
    "Access-Control-Max-Age": "86400",
  };
}
