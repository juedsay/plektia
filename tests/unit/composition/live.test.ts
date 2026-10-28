import { describe, expect, it } from "vitest";

import { createFeaturedRefresh, createLiveRefresh } from "@/composition/live";

import { RecordingPageCache } from "../application/fakes/recording-page-cache";

describe("createFeaturedRefresh", () => {
  it("sin API key de YouTube no arma nada (el cron no hace nada)", () => {
    expect(
      createFeaturedRefresh({ SUPABASE_URL: "http://127.0.0.1:1" }, new RecordingPageCache()),
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

describe("createLiveRefresh", () => {
  const base = { SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_SECRET_KEY: "s" };

  it("sin credenciales de ningún proveedor no arma nada", () => {
    expect(createLiveRefresh(base, new RecordingPageCache())).toBeNull();
    expect(
      createLiveRefresh({ ...base, TWITCH_CLIENT_ID: "solo-el-id" }, new RecordingPageCache()),
    ).toBeNull();
  });

  it("con Twitch o con YouTube, arma el refresco", () => {
    expect(
      typeof createLiveRefresh(
        { ...base, TWITCH_CLIENT_ID: "id", TWITCH_CLIENT_SECRET: "secreto" },
        new RecordingPageCache(),
      ),
    ).toBe("function");
    expect(
      typeof createLiveRefresh({ ...base, YOUTUBE_API_KEY: "k" }, new RecordingPageCache()),
    ).toBe("function");
  });
});
