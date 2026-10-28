import { describe, expect, it } from "vitest";

import { inviteUser, listUsers, revokeUser } from "@/application/admin/users";
import type {
  AccountSummary,
  CurrentAccount,
  InviteOutcome,
  RevokeOutcome,
  UserDirectory,
} from "@/application/ports/user-directory";
import { parseInvite } from "@/domain/invite";
import { err, ok, type Result } from "@/domain/result";

import { RecordingPageCache } from "./fakes/recording-page-cache";

/** Directorio falso: responde lo que se le diga y anota lo que se le pidió. */
class FakeDirectory implements UserDirectory {
  owner = true;
  inviteAnswer: InviteOutcome = "invited";
  revokeAnswer: RevokeOutcome = { status: "revoked", handles: [] };
  readonly invited: { email: string; handle: string }[] = [];
  readonly revoked: string[] = [];
  accounts: AccountSummary[] = [];

  currentAccount(): Promise<CurrentAccount | null> {
    return Promise.resolve({ role: this.owner ? "owner" : "member", disabled: false });
  }

  list(): Promise<Result<readonly AccountSummary[], "forbidden">> {
    return Promise.resolve(this.owner ? ok(this.accounts) : err("forbidden"));
  }

  invite(email: string, handle: string): Promise<Result<InviteOutcome, "forbidden">> {
    if (!this.owner) return Promise.resolve(err("forbidden"));
    this.invited.push({ email, handle });
    return Promise.resolve(ok(this.inviteAnswer));
  }

  revoke(email: string): Promise<Result<RevokeOutcome, "forbidden">> {
    if (!this.owner) return Promise.resolve(err("forbidden"));
    this.revoked.push(email);
    return Promise.resolve(ok(this.revokeAnswer));
  }
}

describe("parseInvite", () => {
  it("normaliza el correo y el handle", () => {
    expect(parseInvite({ email: "  Ana@Ejemplo.COM ", handle: " Ana-Diseno " })).toEqual({
      ok: true,
      value: { email: "ana@ejemplo.com", handle: "ana-diseno" },
    });
  });

  it("marca cada campo inválido, también un handle reservado", () => {
    const invalid = parseInvite({ email: "no-es-correo", handle: "a" });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(Object.keys(invalid.error.fields)).toEqual(["email", "handle"]);
    expect(parseInvite({ email: "ana@ejemplo.com", handle: "admin" })).toMatchObject({
      ok: false,
      error: { fields: { handle: "Ese nombre de usuario está reservado." } },
    });
    expect(parseInvite(null).ok).toBe(false);
  });
});

describe("inviteUser", () => {
  it("invita con los datos normalizados", async () => {
    const users = new FakeDirectory();
    expect(await inviteUser({ users })({ email: "Ana@ejemplo.com", handle: "ana" })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(users.invited).toEqual([{ email: "ana@ejemplo.com", handle: "ana" }]);
  });

  it("datos inválidos no llegan a la base", async () => {
    const users = new FakeDirectory();
    expect((await inviteUser({ users })({ email: "x", handle: "ana" })).ok).toBe(false);
    expect(users.invited).toEqual([]);
  });

  it.each([
    ["email_taken", "email"],
    ["handle_taken", "handle"],
    ["invalid_email", "email"],
    ["invalid_handle", "handle"],
  ] as const)("lo que dice la base (%s) va junto al campo %s", async (answer, field) => {
    const users = new FakeDirectory();
    users.inviteAnswer = answer;
    const result = await inviteUser({ users })({ email: "ana@ejemplo.com", handle: "ana" });
    expect(result).toMatchObject({ ok: false, error: { kind: "invalid_input" } });
    if (!result.ok && typeof result.error === "object") {
      expect(Object.keys(result.error.fields)).toEqual([field]);
    }
  });

  it("si no es owner, forbidden", async () => {
    const users = new FakeDirectory();
    users.owner = false;
    expect(await inviteUser({ users })({ email: "ana@ejemplo.com", handle: "ana" })).toEqual({
      ok: false,
      error: "forbidden",
    });
  });
});

describe("revokeUser", () => {
  it("quita el acceso y saca de la caché todas sus páginas", async () => {
    const users = new FakeDirectory();
    users.revokeAnswer = { status: "revoked", handles: ["ana", "ana-stream"] };
    const cache = new RecordingPageCache();
    expect(await revokeUser({ users, cache })({ email: " Ana@ejemplo.com " })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(users.revoked).toEqual(["ana@ejemplo.com"]);
    expect(cache.purged).toEqual(["profile:ana", "profile:ana-stream"]);
  });

  it("nadie se quita el acceso a sí mismo; un correo desconocido es not_found", async () => {
    const users = new FakeDirectory();
    const cache = new RecordingPageCache();
    users.revokeAnswer = { status: "self", handles: [] };
    expect(await revokeUser({ users, cache })({ email: "yo@ejemplo.com" })).toMatchObject({
      ok: false,
      error: { kind: "invalid_input", fields: { email: "No podés quitarte el acceso a vos." } },
    });
    users.revokeAnswer = { status: "not_found", handles: [] };
    expect(await revokeUser({ users, cache })({ email: "nadie@ejemplo.com" })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(cache.purged).toEqual([]);
  });

  it("un correo inválido no llega a la base; si no es owner, forbidden", async () => {
    const users = new FakeDirectory();
    const cache = new RecordingPageCache();
    expect((await revokeUser({ users, cache })({ email: "x" })).ok).toBe(false);
    expect((await revokeUser({ users, cache })(null)).ok).toBe(false);
    expect(users.revoked).toEqual([]);
    users.owner = false;
    expect(await revokeUser({ users, cache })({ email: "ana@ejemplo.com" })).toEqual({
      ok: false,
      error: "forbidden",
    });
  });
});

describe("listUsers", () => {
  it("devuelve la lista para un owner y forbidden para el resto", async () => {
    const users = new FakeDirectory();
    users.accounts = [
      {
        email: "ana@ejemplo.com",
        handle: "ana",
        role: "member",
        status: "invited",
        invitedAt: "2026-10-28T00:00:00Z",
        lastSignInAt: null,
      },
    ];
    expect(await listUsers({ users })()).toEqual({ ok: true, value: users.accounts });
    users.owner = false;
    expect(await listUsers({ users })()).toEqual({ ok: false, error: "forbidden" });
  });
});
