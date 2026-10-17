import type { ContactInbox } from "@/application/ports/contact";
import type { ContactMessage } from "@/domain/contact";
import { err, ok, type Result } from "@/domain/result";
import type { IngestClient } from "@/infrastructure/supabase/ingest-client";

/** Guarda los mensajes con `ingest_contact_message` (en `private`, fuera de la API pública). */
export class SupabaseContactInbox implements ContactInbox {
  constructor(private readonly ingest: IngestClient) {}

  async save(message: ContactMessage): Promise<Result<void, "limit_reached">> {
    const { error } = await this.ingest.call("ingest_contact_message", {
      p_name: message.name,
      p_email: message.email,
      p_message: message.message,
    });
    if (!error) return ok(undefined);
    if (error.code === "PL429") return err("limit_reached");
    throw new Error(`contacto: error de la base (${error.code}): ${error.message}`);
  }
}
