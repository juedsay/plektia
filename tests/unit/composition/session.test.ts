import { describe, expect, it } from "vitest";

import { createSessionReader } from "@/composition/session";
import { SupabaseSessionReader } from "@/infrastructure/supabase/supabase-session-reader";

const request = new Request("https://app.invalid/admin");
const cookies = { set: () => undefined };

describe("createSessionReader", () => {
  it.each([
    {},
    { url: "https://x.supabase.invalid" },
    { url: "", publishableKey: "k" },
    { url: "u", publishableKey: "" },
  ])("sin configuración completa nadie tiene sesión (%j)", async (config) => {
    const reader = createSessionReader(config, request, cookies);
    expect(reader).not.toBeInstanceOf(SupabaseSessionReader);
    expect(await reader.getCurrentUser()).toBeNull();
  });

  it("con configuración usa Supabase", () => {
    const reader = createSessionReader(
      { url: "https://x.supabase.invalid", publishableKey: "sb_publishable_test" },
      request,
      cookies,
    );
    expect(reader).toBeInstanceOf(SupabaseSessionReader);
  });
});
