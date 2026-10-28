import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  AccountSummary,
  CurrentAccount,
  InviteOutcome,
  RevokeOutcome,
  UserDirectory,
} from "@/application/ports/user-directory";
import { err, ok, type Result } from "@/domain/result";
import type { Database } from "@/infrastructure/supabase/database.types";
import { unexpectedDatabaseError } from "@/infrastructure/supabase/write-errors";

type Client = SupabaseClient<Database>;

const FORBIDDEN = "42501";

const AccountRows = z.array(
  z.object({
    email: z.string(),
    handle: z.string(),
    role: z.enum(["owner", "member"]),
    status: z.enum(["invited", "active", "disabled"]),
    invited_at: z.string(),
    last_sign_in_at: z.string().nullable(),
  }),
);
const InviteResult = z.enum([
  "invited",
  "email_taken",
  "handle_taken",
  "invalid_email",
  "invalid_handle",
]);
const RevokeRows = z
  .array(
    z.object({ status: z.enum(["revoked", "self", "not_found"]), handles: z.array(z.string()) }),
  )
  .length(1);

/**
 * Usuarios habilitados con el cliente de la sesión: las funciones de la base
 * (`admin_*`, `security definer`) verifican adentro que quien llama sea un owner
 * activo; acá un `42501` es "no sos owner". Nunca la `service_role`.
 */
export class SupabaseUserDirectory implements UserDirectory {
  constructor(
    private readonly client: Client,
    private readonly ownerId: string,
  ) {}

  async currentAccount(): Promise<CurrentAccount | null> {
    const { data, error } = await this.client
      .from("profiles")
      .select("role, disabled")
      .eq("id", this.ownerId)
      .maybeSingle();
    if (error) throw unexpected(error);
    return data ? { role: data.role, disabled: data.disabled } : null;
  }

  async list(): Promise<Result<readonly AccountSummary[], "forbidden">> {
    const { data, error } = await this.client.rpc("admin_list_users");
    if (error) return failure(error);
    return ok(
      AccountRows.parse(data).map((row) => ({
        email: row.email,
        handle: row.handle,
        role: row.role,
        status: row.status,
        invitedAt: row.invited_at,
        lastSignInAt: row.last_sign_in_at,
      })),
    );
  }

  async invite(email: string, handle: string): Promise<Result<InviteOutcome, "forbidden">> {
    const { data, error } = await this.client.rpc("admin_invite", {
      target_email: email,
      target_handle: handle,
    });
    if (error) return failure(error);
    return ok(InviteResult.parse(data));
  }

  async revoke(email: string): Promise<Result<RevokeOutcome, "forbidden">> {
    const { data, error } = await this.client.rpc("admin_revoke", { target_email: email });
    if (error) return failure(error);
    const [row] = RevokeRows.parse(data);
    if (!row) throw new Error("users: admin_revoke no devolvió nada");
    return ok({ status: row.status, handles: row.handles });
  }
}

function failure(error: PostgrestError): Result<never, "forbidden"> {
  if (error.code === FORBIDDEN) return err("forbidden");
  throw unexpected(error);
}

function unexpected(error: PostgrestError): Error {
  return unexpectedDatabaseError("users", error);
}
