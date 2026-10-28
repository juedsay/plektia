import type { Result } from "@/domain/result";

// Usuarios habilitados (SPEC-admin-panel). Solo un owner puede usarlo: la base
// lo verifica en cada función, y si quien llama no lo es, la respuesta es
// `forbidden`.

export type AccountRole = "owner" | "member";
export type AccountStatus = "invited" | "active" | "disabled";

export interface AccountSummary {
  readonly email: string;
  readonly handle: string;
  readonly role: AccountRole;
  readonly status: AccountStatus;
  /** Cuándo se invitó (o se creó la cuenta), en ISO 8601. */
  readonly invitedAt: string;
  readonly lastSignInAt: string | null;
}

/** La cuenta de la sesión: si es owner y si sigue activa. */
export interface CurrentAccount {
  readonly role: AccountRole;
  readonly disabled: boolean;
}

export type InviteOutcome =
  "invited" | "email_taken" | "handle_taken" | "invalid_email" | "invalid_handle";

export interface RevokeOutcome {
  readonly status: "revoked" | "self" | "not_found";
  /** Las páginas de la cuenta dada de baja (para sacarlas de la caché). */
  readonly handles: readonly string[];
}

export interface UserDirectory {
  currentAccount(): Promise<CurrentAccount | null>;
  list(): Promise<Result<readonly AccountSummary[], "forbidden">>;
  invite(email: string, handle: string): Promise<Result<InviteOutcome, "forbidden">>;
  revoke(email: string): Promise<Result<RevokeOutcome, "forbidden">>;
}
