import { describe, expect, it } from "vitest";

import { classifySource } from "@/domain/traffic-source";

const HOST = "app.plektia.workers.dev";
const CHROME =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

describe("classifySource", () => {
  it.each([
    ["Instagram (Android)", `${CHROME} Instagram 350.0.0.0 Android`, "instagram"],
    [
      "Instagram (iOS)",
      "Mozilla/5.0 (iPhone) Mobile/15E148 Instagram 350.0.0 (iPhone16,2)",
      "instagram",
    ],
    ["TikTok", `${CHROME} musical_ly_2024 JsSdk/2.0 BytedanceWebview/d8a21c6`, "tiktok"],
    ["Facebook", "Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]", "facebook"],
    ["LinkedIn", "Mozilla/5.0 (iPhone) Mobile/15E148 [LinkedInApp]/9.30", "linkedin"],
    ["X", "Mozilla/5.0 (iPhone) Mobile/15E148 Twitter for iPhone/10.70", "x"],
  ] as const)("navegador embebido de %s", (_name, userAgent, source) => {
    expect(classifySource("", userAgent, HOST)).toBe(source);
  });

  it.each([
    ["https://l.instagram.com/?u=https%3A%2F%2Fapp", "instagram"],
    ["https://t.co/abc123", "x"],
    ["https://www.youtube.com/", "youtube"],
    ["https://lm.facebook.com/l.php", "facebook"],
    ["https://wa.me/", "whatsapp"],
    ["https://www.linkedin.com/feed/", "linkedin"],
    ["https://www.google.com/", "other"],
    ["", "direct"],
    [`https://${HOST}/plektia`, "direct"],
    ["no es una url", "other"],
  ] as const)("referer %s → %s", (referrer, source) => {
    expect(classifySource(referrer, CHROME, HOST)).toBe(source);
  });
});
