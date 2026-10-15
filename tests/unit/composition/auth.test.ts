import { describe, expect, it } from "vitest";

import { createAuthGateway } from "@/composition/auth";
import { SupabaseAuthGateway } from "@/infrastructure/supabase/supabase-auth-gateway";

const request = new Request("https://app.invalid/auth/login");
const cookies = { set: () => undefined };

describe("createAuthGateway", () => {
  it("sin configuración, el login responde 'no disponible' sin romper", async () => {
    const gateway = createAuthGateway({}, request, cookies);
    expect(gateway).not.toBeInstanceOf(SupabaseAuthGateway);
    expect(await gateway.startSignIn("github", "x")).toEqual({
      ok: false,
      error: "auth_unavailable",
    });
    expect(await gateway.completeSignIn("code")).toEqual({ ok: false, error: "sign_in_failed" });
    await expect(gateway.signOut("local")).resolves.toBeUndefined();
  });

  it("con configuración usa Supabase", () => {
    const gateway = createAuthGateway(
      { url: "https://x.supabase.invalid", publishableKey: "sb_publishable_test" },
      request,
      cookies,
    );
    expect(gateway).toBeInstanceOf(SupabaseAuthGateway);
  });
});
