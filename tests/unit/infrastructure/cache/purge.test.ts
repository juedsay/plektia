import { describe, expect, it, vi } from "vitest";

import { WorkerPageCache } from "@/infrastructure/cache/purge";

const succeeds = () => vi.fn(() => Promise.resolve({ success: true, errors: [] }));

describe("WorkerPageCache", () => {
  it("purga la etiqueta del perfil, en minúsculas", async () => {
    const purge = succeeds();
    await new WorkerPageCache(purge).purgeProfile("JuedSay");
    expect(purge).toHaveBeenCalledWith({ tags: ["profile:juedsay"] });
  });

  it("purga las páginas del sitio", async () => {
    const purge = succeeds();
    await new WorkerPageCache(purge).purgeSite();
    expect(purge).toHaveBeenCalledWith({ tags: ["site"] });
  });

  it("sin caché (en local) no hace nada", async () => {
    await expect(new WorkerPageCache(undefined).purgeProfile("x")).resolves.toBeUndefined();
  });

  it.each([
    [
      "Cloudflare la rechaza",
      vi.fn(() => Promise.resolve({ success: false, errors: [{ code: 1, message: "límite" }] })),
    ],
    ["la llamada falla", vi.fn(() => Promise.reject(new Error("caída")))],
  ])("si %s, no rompe la edición y deja rastro", async (_caso, purge) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(new WorkerPageCache(purge).purgeProfile("juedsay")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "cache: la purga falló",
      ["profile:juedsay"],
      expect.anything(),
    );
    warn.mockRestore();
  });
});
