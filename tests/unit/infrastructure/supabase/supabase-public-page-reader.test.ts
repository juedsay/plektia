import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Handle } from "@/domain/handle";
import type { Database } from "@/infrastructure/supabase/database.types";
import { SupabasePublicPageReader } from "@/infrastructure/supabase/supabase-public-page-reader";

function readerAnswering(response: {
  data: unknown;
  error: { code: string; message: string } | null;
}) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) builder[method] = () => builder;
  builder["maybeSingle"] = () => Promise.resolve(response);
  const client = { from: () => builder } as unknown as SupabaseClient<Database>;
  return new SupabasePublicPageReader(client);
}

const handle = "juedsay" as Handle;
const link = {
  id: "3f0c7c4e-2a8f-4f63-9a3c-1f7f3d1e2b10",
  title: "Twitch",
  url: "https://twitch.tv/juedsay",
  description: null,
  provider: "twitch",
  providerHandle: "juedsay",
};
const row = {
  handle: "juedsay",
  display_name: "Julián",
  show_handle: false,
  bio: "Streams y código",
  avatar_path: null,
  theme: "tecnico",
  sections: [
    { id: "3f0c7c4e-2a8f-4f63-9a3c-1f7f3d1e2b11", title: "Redes", showTitle: true, links: [link] },
  ],
  unsectioned_links: [],
};

describe("SupabasePublicPageReader", () => {
  it("convierte la fila de la vista en el modelo de la página", async () => {
    expect(await readerAnswering({ data: row, error: null }).getByHandle(handle)).toEqual({
      handle: "juedsay",
      displayName: "Julián",
      showHandle: false,
      bio: "Streams y código",
      avatarPath: null,
      theme: "tecnico",
      sections: row.sections,
      unsectionedLinks: [],
    });
  });

  it("sin fila (no existe o está dado de baja) devuelve null", async () => {
    expect(await readerAnswering({ data: null, error: null }).getByHandle(handle)).toBeNull();
  });

  it("un error de la base se lanza", async () => {
    await expect(
      readerAnswering({ data: null, error: { code: "XX000", message: "caída" } }).getByHandle(
        handle,
      ),
    ).rejects.toThrow(/XX000/);
  });

  it("si la vista cambia de forma, falla en vez de mostrar datos a medias", async () => {
    const broken = { ...row, sections: [{ id: "x", title: "Redes" }] };
    await expect(
      readerAnswering({ data: broken, error: null }).getByHandle(handle),
    ).rejects.toThrow();
  });
});
