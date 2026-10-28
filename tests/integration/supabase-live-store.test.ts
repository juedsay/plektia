import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import type { Database } from "@/infrastructure/supabase/database.types";
import { createIngestClient } from "@/infrastructure/supabase/ingest-client";
import { SupabaseLiveStore } from "@/infrastructure/supabase/supabase-live-store";

// El refresco del estado en vivo contra Supabase local, con la clave de
// servicio (como el cron). Usa la cuenta Admin del seed (/plektia): ningún otro
// test de integración la usa en paralelo.
const supabase = inject("supabase");
const ADMIN_ID = "adadadad-0000-4000-8000-00000000ad01";
const LOGIN = "integracion_en_vivo";

const service = createClient<Database>(supabase.url, supabase.secretKey, {
  auth: { persistSession: false },
});
const store = new SupabaseLiveStore(
  createIngestClient({ SUPABASE_URL: supabase.url, SUPABASE_SECRET_KEY: supabase.secretKey }),
);
let linkId: string;

describe("SupabaseLiveStore contra Supabase local", () => {
  beforeAll(async () => {
    const { data, error } = await service
      .from("links")
      .insert({
        owner_id: ADMIN_ID,
        page_id: ADMIN_ID,
        title: "Integración en vivo",
        url: `https://www.twitch.tv/${LOGIN}`,
        provider: "twitch",
        provider_handle: LOGIN,
      })
      .select("id")
      .single();
    if (error) throw new Error(`no se pudo crear el link: ${error.message}`);
    linkId = data.id;
  });

  afterAll(async () => {
    await service.from("links").delete().eq("id", linkId);
    await service.from("provider_channels").delete().eq("handle", LOGIN);
  });

  it('un canal se vigila recién con "Transmito en este canal"', async () => {
    const mine = async () =>
      (await store.targets()).find((target) => target.handle === LOGIN) ?? null;
    expect(await mine()).toBeNull();
    await service.from("link_media_settings").insert({ link_id: linkId, watch_live: true });
    expect(await mine()).toEqual({
      provider: "twitch",
      handle: LOGIN,
      channelId: null,
      channelCheckedAt: null,
    });
  });

  it("guarda el estado y avisa qué página purgar solo si cambió", async () => {
    const onAir = {
      isLive: true,
      title: "Probando",
      startedAt: "2026-10-28T20:00:00Z",
      url: `https://www.twitch.tv/${LOGIN}`,
    };
    expect(await store.saveLive("twitch", LOGIN, onAir)).toEqual(["plektia"]);
    expect(await store.saveLive("twitch", LOGIN, onAir)).toEqual([]);
    expect(
      await store.saveLive("twitch", LOGIN, {
        isLive: false,
        title: null,
        startedAt: null,
        url: null,
      }),
    ).toEqual(["plektia"]);
  });

  it("con la clave pública nadie escribe el estado", async () => {
    const anon = createClient<Database>(supabase.url, supabase.publishableKey, {
      auth: { persistSession: false },
    });
    const { error } = await anon.rpc("ingest_live_status", {
      p_provider: "twitch",
      p_handle: LOGIN,
      p_is_live: true,
      p_title: "Falso",
      p_started_at: "2026-10-28T20:00:00Z",
      p_url: `https://www.twitch.tv/${LOGIN}`,
    });
    expect(error?.code).toBe("42501");
  });
});
