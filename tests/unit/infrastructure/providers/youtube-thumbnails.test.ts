import { describe, expect, it } from "vitest";

import { createSafeFetch } from "@/infrastructure/http/safe-fetch";
import {
  binaryFetchFrom,
  THUMBNAIL_HOST,
  youtubeThumbnails,
} from "@/infrastructure/providers/youtube/youtube-thumbnails";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function thumbnailsAnswering(status: number, body: Uint8Array<ArrayBuffer>) {
  const requested: string[] = [];
  const safeFetch = createSafeFetch({
    allowedHosts: [THUMBNAIL_HOST],
    fetcher: (input) => {
      requested.push(input instanceof Request ? input.url : String(input));
      return Promise.resolve(new Response(body, { status }));
    },
  });
  return { thumbnail: youtubeThumbnails(binaryFetchFrom(safeFetch)), requested };
}

describe("youtubeThumbnails", () => {
  it("trae el hqdefault del video y lo devuelve si es un JPEG", async () => {
    const { thumbnail, requested } = thumbnailsAnswering(200, JPEG);
    expect(await thumbnail("aBcDeFgHiJk.jpg")).toEqual({ bytes: JPEG });
    expect(requested).toEqual(["https://i.ytimg.com/vi/aBcDeFgHiJk/hqdefault.jpg"]);
  });

  it.each(["../../etc.jpg", "aBcDeFgHiJk.png", "aBcDeFgHiJ.jpg", "aBcDeFgHiJk.jpg?x=1", ""])(
    "un nombre que no es un ID (%s) no sale del sitio",
    async (file) => {
      const { thumbnail, requested } = thumbnailsAnswering(200, JPEG);
      expect(await thumbnail(file)).toBeNull();
      expect(requested).toEqual([]);
    },
  );

  it("un video borrado (404), algo que no es JPEG o algo enorme no se sirve", async () => {
    expect(await thumbnailsAnswering(404, JPEG).thumbnail("aBcDeFgHiJk.jpg")).toBeNull();
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    expect(await thumbnailsAnswering(200, html).thumbnail("aBcDeFgHiJk.jpg")).toBeNull();
    const huge = new Uint8Array(300 * 1024);
    huge.set(JPEG);
    expect(await thumbnailsAnswering(200, huge).thumbnail("aBcDeFgHiJk.jpg")).toBeNull();
  });
});
