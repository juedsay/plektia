import type { SupabaseClient } from "@supabase/supabase-js";

import type { AccountPreferences } from "@/application/ports/account-preferences";
import type { WriteError } from "@/application/ports/link-repository";
import type { ColorMode } from "@/domain/page";
import { ok, type Result } from "@/domain/result";
import type { Database } from "@/infrastructure/supabase/database.types";
import { unexpectedDatabaseError, writeFailure } from "@/infrastructure/supabase/write-errors";

/** `account_preferences` con la sesión del dueño: la RLS deja ver y cambiar solo la suya. */
export class SupabaseAccountPreferences implements AccountPreferences {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async panelMode(): Promise<ColorMode> {
    const { data, error } = await this.client
      .from("account_preferences")
      .select("panel_mode")
      .maybeSingle();
    if (error) throw unexpectedDatabaseError("account_preferences", error);
    return data?.panel_mode ?? "auto";
  }

  async setPanelMode(mode: ColorMode): Promise<Result<void, WriteError>> {
    // `user_id` lo pone la base (`auth.uid()`); un upsert hace idempotente el pedido.
    const { error } = await this.client
      .from("account_preferences")
      .upsert({ panel_mode: mode }, { onConflict: "user_id" });
    return error ? writeFailure("account_preferences", error) : ok(undefined);
  }
}
