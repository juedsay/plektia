import { describe, expect, it } from "vitest";

import { getLinkMedia, setLinkMedia } from "@/application/links/link-media";
import type { LinkMediaRepository, LinkMediaView } from "@/application/ports/link-media-repository";
import type { WriteError } from "@/application/ports/link-repository";
import { DEFAULT_LINK_MEDIA, type LinkMedia } from "@/domain/link-media";
import { err, ok, type Result } from "@/domain/result";

const LINK_ID = "0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";

/** Repositorio falso: un link y su configuración; anota lo que se guardó. */
class FakeMedia implements LinkMediaRepository {
  view: LinkMediaView | null = {
    linkId: LINK_ID,
    provider: "youtube",
    providerHandle: "@canal",
    media: DEFAULT_LINK_MEDIA,
  };
  readonly saved: LinkMedia[] = [];
  saveAnswer: WriteError | null = null;

  read(): Promise<LinkMediaView | null> {
    return Promise.resolve(this.view);
  }

  save(_linkId: string, media: LinkMedia): Promise<Result<LinkMedia, WriteError>> {
    if (this.saveAnswer) return Promise.resolve(err(this.saveAnswer));
    this.saved.push(media);
    return Promise.resolve(ok(media));
  }
}

describe("getLinkMedia", () => {
  it("devuelve el link con su configuración; uno que no está es not_found", async () => {
    const media = new FakeMedia();
    expect(await getLinkMedia({ media })({ linkId: LINK_ID })).toEqual({
      ok: true,
      value: media.view,
    });
    media.view = null;
    expect(await getLinkMedia({ media })({ linkId: LINK_ID })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect((await getLinkMedia({ media })({ linkId: "x" })).ok).toBe(false);
  });
});

describe("setLinkMedia", () => {
  it("guarda la configuración completa (repetirla deja lo mismo)", async () => {
    const media = new FakeMedia();
    const input = {
      linkId: LINK_ID,
      watchLive: true,
      featuredMode: "pinned",
      pinnedVideo: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    };
    const expected = { watchLive: true, featuredMode: "pinned", pinnedVideoId: "dQw4w9WgXcQ" };
    expect(await setLinkMedia({ media })(input)).toEqual({ ok: true, value: expected });
    expect(await setLinkMedia({ media })(input)).toEqual({ ok: true, value: expected });
    expect(media.saved).toEqual([expected, expected]);
  });

  it("lo inválido o lo que el link no admite no llega a la base", async () => {
    const media = new FakeMedia();
    expect(
      (await setLinkMedia({ media })({ linkId: "x", watchLive: true, featuredMode: "none" })).ok,
    ).toBe(false);
    expect(
      (await setLinkMedia({ media })({ linkId: LINK_ID, watchLive: 1, featuredMode: "none" })).ok,
    ).toBe(false);

    media.view = {
      linkId: LINK_ID,
      provider: "twitch",
      providerHandle: "canal",
      media: DEFAULT_LINK_MEDIA,
    };
    expect(
      await setLinkMedia({ media })({
        linkId: LINK_ID,
        watchLive: true,
        featuredMode: "latest_stream",
      }),
    ).toMatchObject({
      ok: false,
      error: { kind: "invalid_input", fields: { featuredMode: expect.any(String) as unknown } },
    });

    media.view = null;
    expect(
      await setLinkMedia({ media })({ linkId: LINK_ID, watchLive: false, featuredMode: "none" }),
    ).toEqual({ ok: false, error: "not_found" });
    expect(media.saved).toEqual([]);
  });

  it("un error de la base se devuelve tal cual", async () => {
    const media = new FakeMedia();
    media.saveAnswer = "forbidden";
    expect(
      await setLinkMedia({ media })({ linkId: LINK_ID, watchLive: true, featuredMode: "none" }),
    ).toEqual({ ok: false, error: "forbidden" });
  });
});
