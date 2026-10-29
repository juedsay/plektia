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
  builder["order"] = () => Promise.resolve(response);
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
  placement: "both",
  highlight: "top",
};
const row = {
  handle: "juedsay",
  display_name: "Julián",
  show_handle: false,
  bio: "Streams y código",
  avatar_path: null,
  theme: "tecnico",
  color_mode: "light",
  accent: "cielo",
  link_shape: "pills",
  name_font: "nunito",
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
      colorMode: "light",
      accent: "cielo",
      linkShape: "pills",
      nameFont: "nunito",
      sections: [{ ...row.sections[0], links: [{ ...link, featured: null, live: null }] }],
      unsectionedLinks: [],
    });
  });

  it("lee el directo en curso de un canal vigilado", async () => {
    const onAir = {
      ...link,
      live: {
        title: "Programando",
        startedAt: "2026-10-28T20:00:00+00:00",
        url: "https://www.twitch.tv/juedsay",
      },
    };
    const page = await readerAnswering({
      data: { ...row, sections: [], unsectioned_links: [onAir] },
      error: null,
    }).getByHandle(handle);
    expect(page?.unsectionedLinks[0]?.live).toEqual({
      title: "Programando",
      startedAt: "2026-10-28T20:00:00+00:00",
    });
  });

  it("lee lo destacado de un link de YouTube y si está fijado", async () => {
    const youtube = {
      ...link,
      provider: "youtube",
      providerHandle: "@juedsay",
      featured: {
        videoId: "aBcDeFgHiJk",
        kind: "short",
        title: "Un Short",
        publishedAt: "2026-10-27T10:00:00+00:00",
        durationSeconds: 45,
        mode: "pinned",
      },
    };
    const page = await readerAnswering({
      data: { ...row, sections: [], unsectioned_links: [youtube] },
      error: null,
    }).getByHandle(handle);
    expect(page?.unsectionedLinks[0]?.featured).toEqual({
      videoId: "aBcDeFgHiJk",
      kind: "short",
      title: "Un Short",
      publishedAt: "2026-10-27T10:00:00+00:00",
      durationSeconds: 45,
      pinned: true,
    });

    const broken = { ...youtube, featured: { ...youtube.featured, videoId: "../../x" } };
    await expect(
      readerAnswering({
        data: { ...row, sections: [], unsectioned_links: [broken] },
        error: null,
      }).getByHandle(handle),
    ).rejects.toThrow();
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

  it("lista los handles de los perfiles activos", async () => {
    const reader = readerAnswering({ data: [{ handle: "a" }, { handle: "b" }], error: null });
    expect(await reader.listHandles()).toEqual(["a", "b"]);
  });

  it("un error al listar handles se lanza", async () => {
    const reader = readerAnswering({ data: null, error: { code: "XX000", message: "caída" } });
    await expect(reader.listHandles()).rejects.toThrow(/XX000/);
  });
});
