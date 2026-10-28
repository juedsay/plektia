import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/supabase/database.types";
import { SupabaseUserDirectory } from "@/infrastructure/supabase/supabase-user-directory";

import { clientFor } from "./session-client";

// Usuarios habilitados contra Supabase local: las funciones `admin_*` con un
// owner y con un member. No da de baja cuentas del seed (otros tests las usan):
// eso lo prueba pgTAP dentro de una transacción.
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const EMAIL = "integracion-invitada@plektia.test";

let owner: SupabaseUserDirectory;
let member: SupabaseUserDirectory;
let ownerClient: SupabaseClient<Database>;

describe("SupabaseUserDirectory contra Supabase local", () => {
  beforeAll(async () => {
    ownerClient = await clientFor("owner@plektia.test");
    owner = new SupabaseUserDirectory(ownerClient, OWNER_ID);
    member = new SupabaseUserDirectory(await clientFor("member@plektia.test"), MEMBER_ID);
    await owner.revoke(EMAIL);
  });

  afterAll(async () => {
    await owner.revoke(EMAIL);
  });

  it("cada uno lee su propia cuenta", async () => {
    expect(await owner.currentAccount()).toEqual({ role: "owner", disabled: false });
    expect(await member.currentAccount()).toEqual({ role: "member", disabled: false });
  });

  it("un member no puede nada: forbidden", async () => {
    expect(await member.list()).toEqual({ ok: false, error: "forbidden" });
    expect(await member.invite(EMAIL, "integracion")).toEqual({ ok: false, error: "forbidden" });
    expect(await member.revoke("owner@plektia.test")).toEqual({ ok: false, error: "forbidden" });
  });

  it("el owner invita, lo ve en la lista y quita el acceso", async () => {
    expect(await owner.invite(EMAIL, "integracion")).toEqual({ ok: true, value: "invited" });
    expect(await owner.invite(EMAIL, "otro-integracion")).toEqual({
      ok: true,
      value: "email_taken",
    });

    const listed = await owner.list();
    const row = listed.ok ? listed.value.find((account) => account.email === EMAIL) : undefined;
    expect(row).toMatchObject({ handle: "integracion", role: "member", status: "invited" });

    expect(await owner.revoke(EMAIL)).toEqual({
      ok: true,
      value: { status: "revoked", handles: [] },
    });
    expect(await owner.revoke(EMAIL)).toEqual({
      ok: true,
      value: { status: "not_found", handles: [] },
    });
  });

  it("el owner no se quita el acceso a sí mismo", async () => {
    expect(await owner.revoke("owner@plektia.test")).toEqual({
      ok: true,
      value: { status: "self", handles: [] },
    });
  });
});
