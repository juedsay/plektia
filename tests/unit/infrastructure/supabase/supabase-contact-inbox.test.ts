import { describe, expect, it } from "vitest";

import {
  createIngestClient,
  type IngestClient,
  type IngestError,
} from "@/infrastructure/supabase/ingest-client";
import { SupabaseContactInbox } from "@/infrastructure/supabase/supabase-contact-inbox";

function ingestAnswering(error: IngestError | null) {
  const calls: unknown[] = [];
  const client: IngestClient = {
    call: (fn, args) => {
      calls.push([fn, args]);
      return Promise.resolve({ error });
    },
  };
  return { client, calls };
}

const message = { name: "Ana", email: "ana@example.com", message: "Hola" };

describe("SupabaseContactInbox", () => {
  it("guarda con ingest_contact_message", async () => {
    const { client, calls } = ingestAnswering(null);
    expect(await new SupabaseContactInbox(client).save(message)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(calls).toEqual([
      ["ingest_contact_message", { p_name: "Ana", p_email: "ana@example.com", p_message: "Hola" }],
    ]);
  });

  it("el tope de la base se traduce a limit_reached", async () => {
    const { client } = ingestAnswering({ code: "PL429", message: "demasiados" });
    expect(await new SupabaseContactInbox(client).save(message)).toEqual({
      ok: false,
      error: "limit_reached",
    });
  });

  it("otro error no se esconde: se lanza", async () => {
    const { client } = ingestAnswering({ code: "23514", message: "check" });
    await expect(new SupabaseContactInbox(client).save(message)).rejects.toThrow(/23514/);
  });
});

describe("createIngestClient", () => {
  it.each([{ SUPABASE_URL: "", SUPABASE_SECRET_KEY: "k" }, { SUPABASE_URL: "https://x.invalid" }])(
    "sin configuración completa falla claro (%j)",
    (env) => {
      expect(() => createIngestClient(env)).toThrow(/clave de servicio/);
    },
  );

  it("con configuración arma el cliente", () => {
    const client = createIngestClient({
      SUPABASE_URL: "https://x.supabase.invalid",
      SUPABASE_SECRET_KEY: "clave-de-prueba",
    });
    expect(typeof client.call).toBe("function");
  });
});
