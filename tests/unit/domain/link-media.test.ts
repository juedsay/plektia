import { describe, expect, it } from "vitest";

import {
  mediaCapabilities,
  parseLinkMediaInput,
  parseYouTubeVideoId,
  unsupportedMediaFields,
} from "@/domain/link-media";

describe("parseYouTubeVideoId", () => {
  it.each([
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["  dQw4w9WgXcQ  ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/aBc_dEf-123", "aBc_dEf-123"],
    ["https://youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("%s → %s", (input, id) => {
    expect(parseYouTubeVideoId(input)).toBe(id);
  });

  it.each([
    "",
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
    "https://evil.com/youtu.be/dQw4w9WgXcQ",
    "https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=corto",
    "https://www.youtube.com/watch?v=../../etc/pass",
    "https://www.youtube.com/@canal",
    "https://www.youtube.com/playlist?list=dQw4w9WgXcQ",
    "javascript:alert(1)",
    "dQw4w9WgXc!",
  ])("rechaza %s", (input) => {
    expect(parseYouTubeVideoId(input)).toBeNull();
  });
});

describe("parseLinkMediaInput", () => {
  it("guarda solo el ID del video fijado", () => {
    expect(
      parseLinkMediaInput({
        watchLive: true,
        featuredMode: "pinned",
        pinnedVideo: "https://youtu.be/dQw4w9WgXcQ",
      }),
    ).toEqual({
      ok: true,
      value: { watchLive: true, featuredMode: "pinned", pinnedVideoId: "dQw4w9WgXcQ" },
    });
  });

  it("sin 'Fijado', descarta el video", () => {
    expect(
      parseLinkMediaInput({ watchLive: false, featuredMode: "none", pinnedVideo: "dQw4w9WgXcQ" }),
    ).toEqual({
      ok: true,
      value: { watchLive: false, featuredMode: "none", pinnedVideoId: null },
    });
  });

  it("'Fijado' sin un video válido se marca junto al campo", () => {
    expect(
      parseLinkMediaInput({ watchLive: false, featuredMode: "pinned", pinnedVideo: "hola" }),
    ).toMatchObject({
      ok: false,
      error: { fields: { pinnedVideo: "Pegá el link de un video o Short de YouTube." } },
    });
    expect(parseLinkMediaInput({ watchLive: false, featuredMode: "pinned" }).ok).toBe(false);
  });

  it("rechaza lo que no es la configuración", () => {
    expect(parseLinkMediaInput(null).ok).toBe(false);
    expect(parseLinkMediaInput({ watchLive: "sí", featuredMode: "none" })).toMatchObject({
      ok: false,
      error: { fields: { watchLive: expect.any(String) as unknown } },
    });
    expect(parseLinkMediaInput({ watchLive: false, featuredMode: "todo" })).toMatchObject({
      ok: false,
      error: { fields: { featuredMode: "Elegí qué contenido destacar." } },
    });
    expect(
      parseLinkMediaInput({
        watchLive: false,
        featuredMode: "pinned",
        pinnedVideo: "x".repeat(3000),
      }).ok,
    ).toBe(false);
  });
});

describe("mediaCapabilities y unsupportedMediaFields", () => {
  it("vigilar pide un canal de YouTube, Twitch o Kick; destacar, uno de YouTube", () => {
    expect(mediaCapabilities({ provider: "youtube", providerHandle: "@canal" })).toEqual({
      canWatchLive: true,
      canFeature: true,
    });
    expect(mediaCapabilities({ provider: "kick", providerHandle: "canal" })).toEqual({
      canWatchLive: true,
      canFeature: false,
    });
    expect(mediaCapabilities({ provider: "youtube", providerHandle: null })).toEqual({
      canWatchLive: false,
      canFeature: false,
    });
    expect(mediaCapabilities({ provider: "github", providerHandle: null })).toEqual({
      canWatchLive: false,
      canFeature: false,
    });
  });

  it("marca cada opción que el link no admite", () => {
    const twitch = mediaCapabilities({ provider: "twitch", providerHandle: "canal" });
    expect(
      unsupportedMediaFields(
        { watchLive: true, featuredMode: "latest_short", pinnedVideoId: null },
        twitch,
      ),
    ).toEqual({ featuredMode: "El contenido destacado es solo para canales de YouTube." });
    const generic = mediaCapabilities({ provider: "generic", providerHandle: null });
    expect(
      unsupportedMediaFields(
        { watchLive: true, featuredMode: "latest_video", pinnedVideoId: null },
        generic,
      ),
    ).toEqual({ watchLive: "Solo se vigila un canal de YouTube, Twitch o Kick." });
  });
});
