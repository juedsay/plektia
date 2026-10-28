import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEFAULT_LINK_MEDIA } from "@/domain/link-media";
import type { Database } from "@/infrastructure/supabase/database.types";
import { SupabaseLinkMediaRepository } from "@/infrastructure/supabase/supabase-link-media-repository";

import { clientFor } from "./session-client";

// La cuenta Admin del seed (/plektia): ningún otro test de integración la usa,
// así los links de este archivo no chocan con los de otros que corren a la par.
const ADMIN_ID = "adadadad-0000-4000-8000-00000000ad01";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

let admin: SupabaseClient<Database>;
let media: SupabaseLinkMediaRepository;
let channelId: string;
let genericId: string;

async function insertLink(url: string, provider: "youtube" | "generic", handle: string | null) {
  const { data, error } = await admin
    .from("links")
    .insert({
      page_id: ADMIN_ID,
      title: "Integración medios",
      url,
      provider,
      provider_handle: handle,
    })
    .select("id")
    .single();
  if (error) throw new Error(`no se pudo crear el link: ${error.message}`);
  return data.id;
}

describe("SupabaseLinkMediaRepository contra Supabase local", () => {
  beforeAll(async () => {
    admin = await clientFor("admin@plektia.test");
    media = new SupabaseLinkMediaRepository(admin, ADMIN_ID);
    channelId = await insertLink("https://www.youtube.com/@integracion", "youtube", "@integracion");
    genericId = await insertLink("https://plektia.app/integracion", "generic", null);
  });

  afterAll(async () => {
    await admin.from("links").delete().in("id", [channelId, genericId]);
  });

  it("sin configuración, el link usa la predeterminada", async () => {
    expect(await media.read(channelId)).toEqual({
      linkId: channelId,
      provider: "youtube",
      providerHandle: "@integracion",
      media: DEFAULT_LINK_MEDIA,
    });
  });

  it("guarda y lee; repetir el guardado deja lo mismo", async () => {
    const pinned = {
      watchLive: true,
      featuredMode: "pinned",
      pinnedVideoId: "dQw4w9WgXcQ",
    } as const;
    expect(await media.save(channelId, pinned)).toEqual({ ok: true, value: pinned });
    expect(await media.save(channelId, pinned)).toEqual({ ok: true, value: pinned });
    expect((await media.read(channelId))?.media).toEqual(pinned);

    const short = { watchLive: false, featuredMode: "latest_short", pinnedVideoId: null } as const;
    expect(await media.save(channelId, short)).toEqual({ ok: true, value: short });
  });

  it("la base rechaza lo que el link no admite", async () => {
    expect(
      await media.save(genericId, {
        watchLive: true,
        featuredMode: "latest_video",
        pinnedVideoId: null,
      }),
    ).toEqual({ ok: false, error: "invalid_input" });
  });

  it("otra cuenta no ve ni cambia la configuración ajena", async () => {
    const member = new SupabaseLinkMediaRepository(
      await clientFor("member@plektia.test"),
      MEMBER_ID,
    );
    expect(await member.read(channelId)).toBeNull();
    const foreign = new SupabaseLinkMediaRepository(
      await clientFor("member@plektia.test"),
      ADMIN_ID,
    );
    expect((await foreign.read(channelId))?.media).toEqual(DEFAULT_LINK_MEDIA);
    expect(
      await foreign.save(channelId, {
        watchLive: false,
        featuredMode: "none",
        pinnedVideoId: null,
      }),
    ).toEqual({ ok: false, error: "forbidden" });
    expect((await media.read(channelId))?.media.featuredMode).toBe("latest_short");
  });
});
