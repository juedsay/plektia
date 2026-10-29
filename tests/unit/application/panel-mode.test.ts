import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { setPanelMode } from "@/application/account/panel-mode";
import type { AccountPreferences } from "@/application/ports/account-preferences";
import { err, ok } from "@/domain/result";
import type { Database } from "@/infrastructure/supabase/database.types";
import { SupabaseAccountPreferences } from "@/infrastructure/supabase/supabase-account-preferences";

describe("modo del panel", () => {
  it("guarda un modo válido y rechaza cualquier otro sin llegar a la base", async () => {
    const save = vi.fn<AccountPreferences["setPanelMode"]>(() => Promise.resolve(ok(undefined)));
    const preferences: AccountPreferences = {
      panelMode: () => Promise.resolve("auto"),
      setPanelMode: save,
    };
    expect(await setPanelMode({ preferences })({ panelMode: "light" })).toEqual(ok(undefined));
    expect(save).toHaveBeenCalledWith("light");
    expect((await setPanelMode({ preferences })({ panelMode: "sepia" })).ok).toBe(false);
    expect((await setPanelMode({ preferences })(null)).ok).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
  });
});

function clientAnswering(result: {
  data: unknown;
  error: { code: string; message: string } | null;
}) {
  const builder: Record<string, unknown> = {};
  builder["select"] = () => builder;
  builder["maybeSingle"] = () => Promise.resolve(result);
  const upsert = vi.fn(() => Promise.resolve({ error: result.error }));
  builder["upsert"] = upsert;
  const client = { from: () => builder } as unknown as SupabaseClient<Database>;
  return { client, upsert };
}

describe("preferencias en Supabase", () => {
  it("sin fila, el panel va en automático; con fila, lo guardado", async () => {
    expect(
      await new SupabaseAccountPreferences(
        clientAnswering({ data: null, error: null }).client,
      ).panelMode(),
    ).toBe("auto");
    expect(
      await new SupabaseAccountPreferences(
        clientAnswering({ data: { panel_mode: "dark" }, error: null }).client,
      ).panelMode(),
    ).toBe("dark");
  });

  it("guardar es un upsert por cuenta; un rechazo de la RLS vuelve como error del dominio", async () => {
    const { client, upsert } = clientAnswering({ data: null, error: null });
    expect(await new SupabaseAccountPreferences(client).setPanelMode("light")).toEqual(
      ok(undefined),
    );
    expect(upsert).toHaveBeenCalledWith({ panel_mode: "light" }, { onConflict: "user_id" });
    const refused = clientAnswering({ data: null, error: { code: "42501", message: "rls" } });
    expect(await new SupabaseAccountPreferences(refused.client).setPanelMode("dark")).toEqual(
      err("forbidden"),
    );
  });

  it("un error inesperado al leer se lanza", async () => {
    const broken = clientAnswering({ data: null, error: { code: "08006", message: "caída" } });
    await expect(new SupabaseAccountPreferences(broken.client).panelMode()).rejects.toThrow(
      /08006/,
    );
  });
});
