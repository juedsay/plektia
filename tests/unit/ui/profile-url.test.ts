import { describe, expect, it } from "vitest";

import { profilePrefix, profileUrlFor } from "@/ui/view/profile-url";
import { SOCIAL_NETWORKS, socialProfileFor } from "@/ui/view/social-profile";

describe("profileUrlFor", () => {
  it.each([
    ["instagram", "juedsay", "https://www.instagram.com/juedsay"],
    ["youtube", "juedsay", "https://www.youtube.com/@juedsay"],
    ["tiktok", "@juedsay", "https://www.tiktok.com/@juedsay"],
    ["x", "juedsay", "https://x.com/juedsay"],
    ["twitch", "juedsay", "https://www.twitch.tv/juedsay"],
    ["kick", "juedsay", "https://kick.com/juedsay"],
    ["github", "juedsay", "https://github.com/juedsay"],
    ["linkedin", "julian-simon", "https://www.linkedin.com/in/julian-simon"],
    ["facebook", "julian.simon", "https://www.facebook.com/julian.simon"],
    ["threads", "juedsay", "https://www.threads.net/@juedsay"],
    ["bluesky", "juedsay.bsky.social", "https://bsky.app/profile/juedsay.bsky.social"],
  ] as const)("%s: %s → %s", (network, input, url) => {
    expect(profileUrlFor(network, input)).toEqual({
      ok: true,
      url,
      username: input.replace(/^@/, ""),
    });
  });

  it("cada URL armada vuelve a reconocerse como el perfil de esa red", () => {
    for (const network of SOCIAL_NETWORKS) {
      const result = profileUrlFor(
        network,
        network === "bluesky" ? "plektia.bsky.social" : "plektia",
      );
      expect(result.ok, network).toBe(true);
      if (result.ok) expect(socialProfileFor(result.url)?.network).toBe(network);
    }
  });

  it("acepta el link pegado del perfil, con o sin https://", () => {
    expect(profileUrlFor("instagram", "https://www.instagram.com/juedsay/")).toMatchObject({
      ok: true,
      url: "https://www.instagram.com/juedsay",
    });
    expect(profileUrlFor("youtube", "youtube.com/@juedsay")).toMatchObject({
      ok: true,
      url: "https://www.youtube.com/@juedsay",
    });
  });

  it("un link de otra red sugiere elegir esa red", () => {
    expect(profileUrlFor("instagram", "https://github.com/juedsay")).toEqual({
      ok: false,
      message: 'Ese link es de GitHub: elegí GitHub o pegalo en "Otro link".',
    });
  });

  it.each([
    ["instagram", "", "Escribí tu usuario de Instagram."],
    ["instagram", "   ", "Escribí tu usuario de Instagram."],
    ["instagram", "con espacios", "no parece un usuario de Instagram"],
    ["x", "un_usuario_demasiado_largo", "no parece un usuario de X"],
    ["github", "explore", "no parece un usuario de GitHub"],
    ["instagram", "https://www.instagram.com/p/abc123", "no es de un perfil de Instagram"],
    ["instagram", "juedsay/../../evil", "no parece un usuario de Instagram"],
  ] as const)("%s %o se rechaza", (network, input, message) => {
    const result = profileUrlFor(network, input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(message);
  });

  it("muestra el prefijo de cada red", () => {
    expect(profilePrefix("linkedin")).toBe("linkedin.com/in/");
    expect(profilePrefix("youtube")).toBe("youtube.com/@");
  });
});
