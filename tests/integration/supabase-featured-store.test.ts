import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import type { Database } from "@/infrastructure/supabase/database.types";
import { createIngestClient } from "@/infrastructure/supabase/ingest-client";
import {
  IngestQuotaBudget,
  SupabaseFeaturedStore,
} from "@/infrastructure/supabase/supabase-featured-store";

// El refresco del contenido destacado contra Supabase local, con la clave de
// servicio (como el cron). Usa la cuenta Admin del seed (/plektia): ningún
// otro test de integración la usa en paralelo.
const supabase = inject("supabase");
const ADMIN_ID = "adadadad-0000-4000-8000-00000000ad01";
const HANDLE = "@integracion-destacado";

const service = createClient<Database>(supabase.url, supabase.secretKey, {
  auth: { persistSession: false },
});
const ingest = createIngestClient({
  SUPABASE_URL: supabase.url,
  SUPABASE_SECRET_KEY: supabase.secretKey,
});
const store = new SupabaseFeaturedStore(ingest);
let linkId: string;

describe("SupabaseFeaturedStore contra Supabase local", () => {
  beforeAll(async () => {
    const { data, error } = await service
      .from("links")
      .insert({
        owner_id: ADMIN_ID,
        page_id: ADMIN_ID,
        title: "Integración destacado",
        url: `https://www.youtube.com/${HANDLE}`,
        provider: "youtube",
        provider_handle: HANDLE,
      })
      .select("id")
      .single();
    if (error) throw new Error(`no se pudo crear el link: ${error.message}`);
    linkId = data.id;
  });

  afterAll(async () => {
    await service.from("links").delete().eq("id", linkId);
    await service.from("provider_channels").delete().eq("handle", HANDLE);
  });

  it("el lock se toma una sola vez hasta liberarlo", async () => {
    expect(await store.tryLock("integracion", 60)).toBe(true);
    expect(await store.tryLock("integracion", 60)).toBe(false);
    await store.releaseLock("integracion");
    expect(await store.tryLock("integracion", 60)).toBe(true);
    await store.releaseLock("integracion");
  });

  it("lista el link, guarda su canal y lo destacado, y avisa qué página purgar", async () => {
    const mine = () =>
      store.targets().then((targets) => targets.find((target) => target.linkId === linkId));
    expect(await mine()).toMatchObject({
      handle: HANDLE,
      mode: "latest_video",
      channelId: null,
      currentVideoId: null,
    });

    await store.saveChannel(HANDLE, "UCabcdefghijklmnopqrstuv", null);
    expect((await mine())?.channelId).toBe("UCabcdefghijklmnopqrstuv");

    const featured = {
      videoId: "dQw4w9WgXcQ",
      kind: "video",
      title: "Un video",
      publishedAt: "2026-10-27T10:00:00Z",
      durationSeconds: null,
    } as const;
    expect(await store.saveFeatured(linkId, featured)).toBe("plektia");
    expect(await store.saveFeatured(linkId, featured)).toBeNull();
    expect((await mine())?.currentVideoId).toBe("dQw4w9WgXcQ");

    expect(await store.clearFeatured(linkId)).toBe("plektia");
    expect(await store.clearFeatured(linkId)).toBeNull();
  });

  it("un canal inexistente se guarda sin ID", async () => {
    await store.saveChannel(HANDLE, null, "canal inexistente");
    const target = (await store.targets()).find((candidate) => candidate.linkId === linkId);
    expect(target?.channelId).toBeNull();
    expect(target?.channelCheckedAt).not.toBeNull();
  });

  it("el presupuesto de cuota corta al llegar al límite diario", async () => {
    const budget = new IngestQuotaBudget(ingest, `integracion-${crypto.randomUUID()}`, 3);
    expect(await budget.tryConsume(2)).toBe(true);
    expect(await budget.tryConsume(2)).toBe(false);
    expect(await budget.tryConsume(1)).toBe(true);
    expect(await budget.tryConsume(1)).toBe(false);
  });

  it("con la clave pública nadie llama a la ingesta", async () => {
    const anon = createClient<Database>(supabase.url, supabase.publishableKey, {
      auth: { persistSession: false },
    });
    const { error } = await anon.rpc("ingest_try_lock", { p_job: "featured", p_seconds: 60 });
    expect(error?.code).toBe("42501");
  });
});
