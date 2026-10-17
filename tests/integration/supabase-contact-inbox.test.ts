import { createClient } from "@supabase/supabase-js";
import { describe, expect, inject, it } from "vitest";

import type { Database } from "@/infrastructure/supabase/database.types";
import { createIngestClient } from "@/infrastructure/supabase/ingest-client";
import { SupabaseContactInbox } from "@/infrastructure/supabase/supabase-contact-inbox";

const supabase = inject("supabase");

describe("contacto contra Supabase local", () => {
  it("el Worker (clave de servicio) guarda un mensaje", async () => {
    const inbox = new SupabaseContactInbox(
      createIngestClient({ SUPABASE_URL: supabase.url, SUPABASE_SECRET_KEY: supabase.secretKey }),
    );
    expect(
      await inbox.save({ name: "Ana", email: "ana@example.com", message: "Prueba de integración" }),
    ).toEqual({ ok: true, value: undefined });
  });

  it("con la clave pública nadie puede guardar mensajes salteándose el Worker", async () => {
    const anon = createClient<Database>(supabase.url, supabase.publishableKey, {
      auth: { persistSession: false },
    });
    const { error } = await anon.rpc("ingest_contact_message", {
      p_name: "Bot",
      p_email: "bot@spam.test",
      p_message: "spam",
    });
    expect(error?.code).toBe("42501");
  });
});
