import type { PageCache } from "@/application/ports/page-cache";
import type { AccountSummary, UserDirectory } from "@/application/ports/user-directory";
import type { UseCaseResult } from "@/application/shared/use-case";
import { invalidInput } from "@/domain/errors";
import { parseEmail, parseInvite } from "@/domain/invite";
import { err, ok } from "@/domain/result";

// Casos de uso del owner sobre los usuarios habilitados (SPEC-admin-panel).

/** Invitaciones pendientes, cuentas activas y dadas de baja. */
export function listUsers(deps: { users: UserDirectory }) {
  return async (): UseCaseResult<readonly AccountSummary[]> => deps.users.list();
}

const INVITE_ERRORS = {
  email_taken: { email: "Ese correo ya está invitado o ya tiene una cuenta." },
  handle_taken: { handle: "Ese nombre de usuario ya lo usa otra página o invitación." },
  invalid_email: { email: "Escribí un correo válido." },
  invalid_handle: { handle: "Ese nombre de usuario está reservado o no es válido." },
} as const;

/** Invita a una persona con su handle (siempre como `member`). */
export function inviteUser(deps: { users: UserDirectory }) {
  return async (raw: unknown): UseCaseResult<void> => {
    const invite = parseInvite(raw);
    if (!invite.ok) return invite;
    const result = await deps.users.invite(invite.value.email, invite.value.handle);
    if (!result.ok) return result;
    if (result.value === "invited") return ok(undefined);
    return err(invalidInput(INVITE_ERRORS[result.value]));
  };
}

/**
 * Quita el acceso: la invitación se borra y la cuenta queda dada de baja (su
 * página deja de publicarse y no puede editar nada). Sus páginas salen de la
 * caché al instante.
 */
export function revokeUser(deps: { users: UserDirectory; cache: PageCache }) {
  return async (raw: unknown): UseCaseResult<void> => {
    const fields = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const email = parseEmail(fields["email"]);
    if (!email.ok) return email;
    const result = await deps.users.revoke(email.value);
    if (!result.ok) return result;
    if (result.value.status === "not_found") return err("not_found");
    if (result.value.status === "self") {
      return err(invalidInput({ email: "No podés quitarte el acceso a vos." }));
    }
    await Promise.all(result.value.handles.map((handle) => deps.cache.purgeProfile(handle)));
    return ok(undefined);
  };
}
