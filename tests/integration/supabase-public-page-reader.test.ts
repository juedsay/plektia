import { createClient } from "@supabase/supabase-js";
import { describe, expect, inject, it } from "vitest";

import { getPublicPage } from "@/application/public/get-public-page";
import type { Database } from "@/infrastructure/supabase/database.types";
import { SupabasePublicPageReader } from "@/infrastructure/supabase/supabase-public-page-reader";

const supabase = inject("supabase");

// Como un visitante: sin sesión, con la clave pública. Lee el seed.
const anon = createClient<Database>(supabase.url, supabase.publishableKey, {
  auth: { persistSession: false },
});
const getPage = getPublicPage({ pages: new SupabasePublicPageReader(anon) });

describe("página pública contra Supabase local (seed)", () => {
  it("devuelve el perfil con secciones y links en orden, en una consulta", async () => {
    const result = await getPage("juedsay");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.displayName).toBeTruthy();
    expect(result.value.sections.length).toBeGreaterThan(0);
    for (const section of result.value.sections) {
      for (const link of section.links) expect(link.url).toMatch(/^(https:\/\/|mailto:)/);
    }
  });

  it("un handle que no existe da not_found", async () => {
    expect(await getPage("nadie-existe")).toEqual({ ok: false, error: "not_found" });
  });
});
