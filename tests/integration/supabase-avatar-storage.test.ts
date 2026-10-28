import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inject } from "vitest";

import { setPageAvatar } from "@/application/pages/set-page-avatar";
import type { Database } from "@/infrastructure/supabase/database.types";
import { avatarImages } from "@/infrastructure/supabase/avatar-images";
import { SupabaseAvatarStorage } from "@/infrastructure/supabase/supabase-avatar-storage";
import { SupabasePageRepository } from "@/infrastructure/supabase/supabase-page-repository";

import { PNG_SIGNATURE, SVG_WITH_SCRIPT, webp } from "../support/webp";
import { RecordingPageCache } from "../unit/application/fakes/recording-page-cache";
import { clientFor } from "./session-client";

// Avatares contra Supabase local (SPEC-admin-panel, tabla de amenazas): las
// políticas del bucket con dos usuarios y la validación con archivos maliciosos.
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const supabase = inject("supabase");

let memberClient: SupabaseClient<Database>;
let ownerClient: SupabaseClient<Database>;
let memberStorage: SupabaseAvatarStorage;
let ownerStorage: SupabaseAvatarStorage;

const fileName = (owner: string, suffix: string) =>
  `${owner}/c0ffee00-0000-4000-8000-${suffix.padStart(12, "0")}.webp`;

async function exists(client: SupabaseClient<Database>, owner: string, path: string) {
  const { data } = await client.storage.from("avatars").list(owner);
  return (data ?? []).some((file) => `${owner}/${file.name}` === path);
}

describe("avatares contra Supabase local", () => {
  beforeAll(async () => {
    memberClient = await clientFor("member@plektia.test");
    ownerClient = await clientFor("owner@plektia.test");
    memberStorage = new SupabaseAvatarStorage(memberClient);
    ownerStorage = new SupabaseAvatarStorage(ownerClient);
  });

  afterAll(async () => {
    await memberClient.from("pages").update({ avatar_path: null }).eq("owner_id", MEMBER_ID);
    for (const [client, owner] of [
      [memberClient, MEMBER_ID],
      [ownerClient, OWNER_ID],
    ] as const) {
      const { data } = await client.storage.from("avatars").list(owner);
      const paths = (data ?? []).map((file) => `${owner}/${file.name}`);
      if (paths.length > 0) await client.storage.from("avatars").remove(paths);
    }
  });

  describe("políticas del bucket (dos usuarios)", () => {
    it("cada cuenta sube a su carpeta, y no a la de otra", async () => {
      expect(await memberStorage.upload(fileName(MEMBER_ID, "1"), webp())).toEqual({
        ok: true,
        value: undefined,
      });
      expect(await memberStorage.upload(fileName(OWNER_ID, "2"), webp())).toEqual({
        ok: false,
        error: "rejected",
      });
    });

    it("nadie borra el avatar de otra cuenta", async () => {
      const ownerFile = fileName(OWNER_ID, "3");
      expect((await ownerStorage.upload(ownerFile, webp())).ok).toBe(true);
      await memberStorage.remove(ownerFile);
      expect(await exists(ownerClient, OWNER_ID, ownerFile)).toBe(true);
    });

    it("el bucket rechaza lo que no es WebP aunque se saltee la app", async () => {
      const { error } = await memberClient.storage
        .from("avatars")
        .upload(fileName(MEMBER_ID, "4"), SVG_WITH_SCRIPT, { contentType: "image/svg+xml" });
      expect(error).not.toBeNull();
    });

    it("el bucket rechaza más de 200 KB aunque se saltee la app", async () => {
      const { error } = await memberClient.storage
        .from("avatars")
        .upload(fileName(MEMBER_ID, "5"), new Uint8Array(300 * 1024), {
          contentType: "image/webp",
        });
      expect(error).not.toBeNull();
    });
  });

  describe("cambiar el avatar de una página", () => {
    const setAvatar = () =>
      setPageAvatar({
        pages: new SupabasePageRepository(memberClient, MEMBER_ID),
        avatars: memberStorage,
        cache: new RecordingPageCache(),
        ownerId: MEMBER_ID,
      });
    const image = (bytes: Uint8Array) => ({
      size: bytes.length,
      bytes: () => Promise.resolve(bytes),
    });

    it.each([
      ["un SVG con un script", SVG_WITH_SCRIPT],
      ["un PNG renombrado", PNG_SIGNATURE],
      ["un archivo de 10 MB", new Uint8Array(10 * 1024 * 1024)],
      ["un WebP de 4000 × 4000", webp({ width: 4000, height: 4000 })],
    ])("rechaza %s", async (_caso, bytes) => {
      const result = await setAvatar()({ pageId: MEMBER_ID }, image(bytes));
      expect(result).toMatchObject({ ok: false, error: { kind: "invalid_input" } });
    });

    it("un WebP válido queda en la página y se sirve como image/webp", async () => {
      const result = await setAvatar()({ pageId: MEMBER_ID }, image(webp()));
      expect(result.ok).toBe(true);
      const path = result.ok ? result.value.avatarPath : null;
      expect(path).toMatch(new RegExp(`^${MEMBER_ID}/[0-9a-f-]{36}\\.webp$`));

      const { data } = await memberClient
        .from("public_page_v")
        .select("avatar_path")
        .eq("handle", "miembro-demo")
        .single();
      expect(data?.avatar_path).toBe(path);

      const body = await avatarImages(supabase.url)(path ?? "");
      expect(body).not.toBeNull();
      const bytes = new Uint8Array(await new Response(body).arrayBuffer());
      expect(bytes).toEqual(webp());
    });
  });
});
