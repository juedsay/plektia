import { describe, expect, it } from "vitest";

import { detectProvider } from "@/domain/provider";

describe("detectProvider", () => {
  it.each([
    ["https://www.youtube.com/@juedsay", "youtube", "@juedsay"],
    ["https://youtube.com/@Jue.Dsay-1", "youtube", "@Jue.Dsay-1"],
    ["https://www.youtube.com/@juedsay/videos", "youtube", "@juedsay"],
    [
      "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv",
      "youtube",
      "UCabcdefghijklmnopqrstuv",
    ],
    // /c/ es un formato viejo: se reconoce YouTube, pero sin un canal que se pueda vigilar.
    ["https://www.youtube.com/c/juedsay", "youtube", null],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", null],
    ["https://www.twitch.tv/juedsay", "twitch", "juedsay"],
    ["https://twitch.tv/JueDsay", "twitch", "juedsay"],
    ["https://www.twitch.tv/directory", "twitch", null],
    ["https://www.twitch.tv/videos/123", "twitch", null],
    ["https://kick.com/juedsay", "kick", "juedsay"],
    ["https://wa.me/5491112345678", "whatsapp", null],
    ["https://api.whatsapp.com/send?phone=5491112345678", "whatsapp", null],
    ["https://github.com/juedsay", "github", null],
    ["https://www.instagram.com/juedsay", "instagram", null],
    ["https://plektia.app", "generic", null],
    ["mailto:hola@plektia.app", "generic", null],
  ])("%s → %s (%s)", (url, provider, handle) => {
    expect(detectProvider(url)).toEqual({ provider, handle });
  });

  // Suplantación: solo cuenta el host exacto (con o sin www).
  it.each([
    "https://youtube.com.evil.com/@juedsay",
    "https://evilyoutube.com/@juedsay",
    "https://youtube.com-evil.com/@juedsay",
    "https://www.twitch.tv.evil.com/juedsay",
    "https://notgithub.com/juedsay",
    "https://evil.com/youtube.com/@juedsay",
    "https://evil.com/?u=https://twitch.tv/juedsay",
  ])("no se deja engañar por %s", (url) => {
    expect(detectProvider(url)).toEqual({ provider: "generic", handle: null });
  });

  it("una URL que no se puede leer es genérica", () => {
    expect(detectProvider("no es una url")).toEqual({ provider: "generic", handle: null });
  });
});
