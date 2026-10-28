import { describe, expect, it } from "vitest";

import { AVATAR_MAX_BYTES } from "@/domain/avatar";
import { avatarImages } from "@/infrastructure/supabase/avatar-images";

import { jpeg, SVG_WITH_SCRIPT, webp } from "../../../support/webp";

const OWNER = "22222222-2222-4222-8222-222222222222";
const FILE = "0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";
const SUPABASE = "https://abc.supabase.co";

/** Storage falso: responde siempre lo mismo y anota qué se le pidió. */
function storageAnswering(status: number, body: Uint8Array | null, contentLength?: number) {
  const requested: string[] = [];
  const fetcher = (input: string) => {
    requested.push(input);
    const headers: Record<string, string> =
      contentLength === undefined ? {} : { "content-length": String(contentLength) };
    return Promise.resolve(new Response(body ? Uint8Array.from(body) : null, { status, headers }));
  };
  return { requested, fetcher };
}

describe("avatarImages", () => {
  it("pide el archivo al bucket público y lo devuelve con su tipo", async () => {
    const { requested, fetcher } = storageAnswering(200, webp());
    const image = await avatarImages(SUPABASE, fetcher)(`${OWNER}/${FILE}.webp`);
    expect(requested).toEqual([
      `${SUPABASE}/storage/v1/object/public/avatars/${OWNER}/${FILE}.webp`,
    ]);
    expect(image?.contentType).toBe("image/webp");
    expect(image?.bytes).toEqual(webp());

    const jpg = await avatarImages(
      SUPABASE,
      storageAnswering(200, jpeg()).fetcher,
    )(`${OWNER}/${FILE}.jpg`);
    expect(jpg?.contentType).toBe("image/jpeg");
  });

  it("si no existe, no hay imagen", async () => {
    const { fetcher } = storageAnswering(404, null);
    expect(await avatarImages(SUPABASE, fetcher)(`${OWNER}/${FILE}.webp`)).toBeNull();
  });

  it("si lo que vuelve de Storage no es un avatar válido, no se sirve", async () => {
    const svg = storageAnswering(200, SVG_WITH_SCRIPT);
    expect(await avatarImages(SUPABASE, svg.fetcher)(`${OWNER}/${FILE}.webp`)).toBeNull();
    // Un WebP guardado como .jpg tampoco: tiene que ser lo que dice su extensión.
    const mismatched = storageAnswering(200, webp());
    expect(await avatarImages(SUPABASE, mismatched.fetcher)(`${OWNER}/${FILE}.jpg`)).toBeNull();
  });

  it("algo más grande que un avatar se descarta sin leerlo", async () => {
    const { fetcher } = storageAnswering(200, webp(), AVATAR_MAX_BYTES + 1);
    expect(await avatarImages(SUPABASE, fetcher)(`${OWNER}/${FILE}.webp`)).toBeNull();
  });

  it.each([
    "../../auth/v1/admin/users",
    `${OWNER}/${FILE}.webp?download`,
    "x/y.webp",
    `${OWNER}/${FILE}.svg`,
  ])("una ruta que no es de avatar (%s) no llega a Storage", async (path) => {
    const { requested, fetcher } = storageAnswering(200, webp());
    expect(await avatarImages(SUPABASE, fetcher)(path)).toBeNull();
    expect(requested).toEqual([]);
  });
});
