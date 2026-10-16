import { describe, expect, it } from "vitest";

import { createPublicPageReader } from "@/composition/public-page";
import { SupabasePublicPageReader } from "@/infrastructure/supabase/supabase-public-page-reader";

describe("createPublicPageReader", () => {
  it.each([{}, { url: "https://x.supabase.invalid" }, { url: "u", publishableKey: "" }])(
    "sin configuración completa falla claro (%j)",
    (config) => {
      expect(() => createPublicPageReader(config)).toThrow(/SUPABASE_URL/);
    },
  );

  it("con configuración lee de Supabase", () => {
    const reader = createPublicPageReader({
      url: "https://x.supabase.invalid",
      publishableKey: "sb_publishable_test",
    });
    expect(reader).toBeInstanceOf(SupabasePublicPageReader);
  });
});
