import { describe, expect, it } from "vitest";

import { avatarImages } from "@/infrastructure/supabase/avatar-images";

const PATH = "22222222-2222-4222-8222-222222222222/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.webp";

function fakeFetch(status: number) {
  const requested: string[] = [];
  const fetcher = (input: string) => {
    requested.push(input);
    return Promise.resolve(new Response(status === 200 ? "webp" : null, { status }));
  };
  return { requested, fetcher };
}

describe("avatarImages", () => {
  it("pide el archivo al bucket público y devuelve su contenido", async () => {
    const { requested, fetcher } = fakeFetch(200);
    const body = await avatarImages("https://abc.supabase.co", fetcher)(PATH);
    expect(requested).toEqual([`https://abc.supabase.co/storage/v1/object/public/avatars/${PATH}`]);
    expect(await new Response(body).text()).toBe("webp");
  });

  it("si no existe, no hay imagen", async () => {
    const { fetcher } = fakeFetch(404);
    expect(await avatarImages("https://abc.supabase.co", fetcher)(PATH)).toBeNull();
  });

  it.each(["../../auth/v1/admin/users", `${PATH}?download`, "x/y.webp"])(
    "una ruta que no es de avatar (%s) no llega a Storage",
    async (path) => {
      const { requested, fetcher } = fakeFetch(200);
      expect(await avatarImages("https://abc.supabase.co", fetcher)(path)).toBeNull();
      expect(requested).toEqual([]);
    },
  );
});
