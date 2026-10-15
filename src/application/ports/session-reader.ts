// Quién hace el pedido. Las páginas y los casos de uso dependen de este puerto,
// no de Supabase Auth (SPEC-identity, "Sesiones").

export interface SessionUser {
  readonly id: string;
  readonly email: string | null;
}

export interface SessionReader {
  /** El usuario con sesión válida (firma y vencimiento verificados) o `null`. */
  getCurrentUser(): Promise<SessionUser | null>;
}
