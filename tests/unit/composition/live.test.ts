import { describe, expect, it } from "vitest";

import { createFeaturedRefresh } from "@/composition/live";

import { RecordingPageCache } from "../application/fakes/recording-page-cache";

describe("createFeaturedRefresh", () => {
  it("sin API key de YouTube no arma nada (el cron no hace nada)", () => {
    expect(
      createFeaturedRefresh(
        { SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_SECRET_KEY: "s" },
        new RecordingPageCache(),
      ),
    ).toBeNull();
  });

  it("con la key, arma el refresco", () => {
    expect(
      typeof createFeaturedRefresh(
        { SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_SECRET_KEY: "s", YOUTUBE_API_KEY: "k" },
        new RecordingPageCache(),
      ),
    ).toBe("function");
  });
});
