import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BreakdownRow,
  DailyRow,
  LinkClicksRow,
  StatsReader,
} from "@/application/ports/stats-reader";
import type { Database } from "@/infrastructure/supabase/database.types";
import { unexpectedDatabaseError } from "@/infrastructure/supabase/write-errors";

// Estadísticas de una página con el cliente de la sesión: la RLS solo deja ver
// las de las páginas propias (una página ajena vuelve vacía). Los totales por
// link y por país u origen se suman en la base: PostgREST corta en 1000 filas,
// y las diarias de 90 días con muchos links o países pasan ese tope.

export class SupabaseStatsReader implements StatsReader {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async daily(pageId: string, from: string, to: string): Promise<readonly DailyRow[]> {
    const { data, error } = await this.client
      .from("stats_daily")
      .select("day, views, clicks")
      .eq("page_id", pageId)
      .gte("day", from)
      .lte("day", to)
      .order("day");
    if (error) throw unexpectedDatabaseError("stats_daily", error);
    return data;
  }

  async linkClicks(pageId: string, from: string, to: string): Promise<readonly LinkClicksRow[]> {
    const { data, error } = await this.client.rpc("page_link_clicks", {
      p_page: pageId,
      p_from: from,
      p_to: to,
    });
    if (error) throw unexpectedDatabaseError("page_link_clicks", error);
    return data.map((row) => ({ linkId: row.link_id, title: row.title, clicks: row.clicks }));
  }

  async breakdown(pageId: string, from: string, to: string): Promise<readonly BreakdownRow[]> {
    const { data, error } = await this.client.rpc("page_stats_breakdown", {
      p_page: pageId,
      p_from: from,
      p_to: to,
    });
    if (error) throw unexpectedDatabaseError("page_stats_breakdown", error);
    return data.flatMap((row) =>
      row.dimension === "country" || row.dimension === "source"
        ? [{ dimension: row.dimension, value: row.value, views: row.views, clicks: row.clicks }]
        : [],
    );
  }
}
