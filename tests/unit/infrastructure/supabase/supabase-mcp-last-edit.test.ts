import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/supabase/database.types";
import { SupabaseMcpConnections } from "@/infrastructure/supabase/supabase-mcp-connections";

const answering = (data: unknown, error: unknown = null) =>
  new SupabaseMcpConnections({
    rpc: () => Promise.resolve({ data, error }),
  } as unknown as SupabaseClient<Database>);

describe("SupabaseMcpConnections.lastEdit", () => {
  it("devuelve la app y cuándo editó", async () => {
    const edit = await answering([
      { client_name: "Claude", edited_at: "2026-10-30T10:00:00Z" },
    ]).lastEdit("l1");
    expect(edit).toEqual({ appName: "Claude", editedAt: "2026-10-30T10:00:00Z" });
  });

  it("el nombre que declara la app sale como una línea segura y corta", async () => {
    const edit = await answering([
      { client_name: `Mi\u202eapp\n${"x".repeat(80)}`, edited_at: "2026-10-30T10:00:00Z" },
    ]).lastEdit("l1");
    expect(edit?.appName.startsWith("Mi app x")).toBe(true);
    expect(Array.from(edit?.appName ?? "")).toHaveLength(40);
  });

  it("sin edición, con un nombre vacío o con un error, nada", async () => {
    expect(await answering([]).lastEdit("l1")).toBeNull();
    expect(
      await answering([{ client_name: " \u200b ", edited_at: "2026-10-30T10:00:00Z" }]).lastEdit(
        "l1",
      ),
    ).toBeNull();
    expect(await answering(null, { code: "42501" }).lastEdit("l1")).toBeNull();
  });
});
