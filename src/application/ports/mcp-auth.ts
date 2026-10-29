// Autenticación de los clientes MCP (SPEC-mcp-server, "Autenticación"). El
// servidor `/mcp` solo sabe que hay un verificador: si el token no pasa, 401.

/** Quién llama por MCP: el usuario, la app conectada y si puede escribir. */
export interface McpCaller {
  readonly userId: string;
  readonly clientId: string;
  readonly canWrite: boolean;
  /** El access token, para hablar con la base con los permisos del usuario. */
  readonly accessToken: string;
}

export interface McpTokenVerifier {
  /** `null` ante cualquier problema (firma, emisor, vencimiento, grant): falla cerrado. */
  verify(accessToken: string): Promise<McpCaller | null>;
}
