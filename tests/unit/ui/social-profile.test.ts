import { describe, expect, it } from "vitest";

import { socialProfileFor } from "@/ui/view/social-profile";

describe("socialProfileFor", () => {
  it.each([
    ["https://www.instagram.com/juedsay/", "instagram", "juedsay"],
    ["https://www.linkedin.com/in/juedsay", "linkedin", "juedsay"],
    ["https://www.twitch.tv/juedsay", "twitch", "juedsay"],
    ["https://github.com/juedsay", "github", "juedsay"],
    ["https://www.youtube.com/@juedsay", "youtube", "juedsay"],
    ["https://x.com/juedsay", "x", "juedsay"],
    ["https://twitter.com/juedsay", "x", "juedsay"],
    ["https://www.tiktok.com/@juedsay", "tiktok", "juedsay"],
    ["https://kick.com/juedsay", "kick", "juedsay"],
    ["https://m.facebook.com/juedsay.oficial", "facebook", "juedsay.oficial"],
    ["https://www.threads.net/@juedsay", "threads", "juedsay"],
    ["https://bsky.app/profile/juedsay.bsky.social", "bluesky", "juedsay.bsky.social"],
  ])("%s → %s @%s", (url, network, username) => {
    expect(socialProfileFor(url)).toMatchObject({ network, username });
  });

  it.each([
    ["https://www.instagram.com/p/C123abc/", "instagram"],
    ["https://github.com/juedsay/plektia", "github"],
    ["https://github.com/features", "github"],
    ["https://www.linkedin.com/company/plektia", "linkedin"],
    ["https://www.youtube.com/watch?v=abc", "youtube"],
    ["https://x.com/intent/post?text=hola", "x"],
    ["https://www.twitch.tv/directory", "twitch"],
  ])("%s es de %s pero no es un perfil: sin usuario", (url, network) => {
    expect(socialProfileFor(url)).toEqual({
      network,
      label: expect.any(String) as string,
      username: null,
    });
  });

  it.each([
    "https://jsimon.vercel.app/",
    "https://instagram.com.evil.test/juedsay",
    "http://instagram.com/juedsay",
    "mailto:hola@plektia.app",
    "no es una url",
  ])("%s no es una red conocida", (url) => {
    expect(socialProfileFor(url)).toBeNull();
  });

  it("trae el nombre visible de la red", () => {
    expect(socialProfileFor("https://www.linkedin.com/in/juedsay")?.label).toBe("LinkedIn");
  });
});
