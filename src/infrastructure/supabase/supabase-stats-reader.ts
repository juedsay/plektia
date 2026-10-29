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
// las de las páginas propias (una página ajena vuelve vacía). Son pocas filas
// (hasta 180 días): se suman acá.

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
    const { data, error } = await this.client
      .from("link_stats_daily")
      .select("link_id, clicks, links!inner (title, page_id)")
      .eq("links.page_id", pageId)
      .gte("day", from)
      .lte("day", to);
    if (error) throw unexpectedDatabaseError("link_stats_daily", error);
    const byLink = new Map<string, LinkClicksRow>();
    for (const row of data) {
      const before = byLink.get(row.link_id);
      byLink.set(row.link_id, {
        linkId: row.link_id,
        title: row.links.title,
        clicks: (before?.clicks ?? 0) + row.clicks,
      });
    }
    return [...byLink.values()];
  }

  async breakdown(pageId: string, from: string, to: string): Promise<readonly BreakdownRow[]> {
    const { data, error } = await this.client
      .from("stats_breakdown_daily")
      .select("dimension, value, views, clicks")
      .eq("page_id", pageId)
      .gte("day", from)
      .lte("day", to);
    if (error) throw unexpectedDatabaseError("stats_breakdown_daily", error);
    const byKey = new Map<string, BreakdownRow>();
    for (const row of data) {
      if (row.dimension !== "country" && row.dimension !== "source") continue;
      const key = `${row.dimension}:${row.value}`;
      const before = byKey.get(key);
      byKey.set(key, {
        dimension: row.dimension,
        value: row.value,
        views: (before?.views ?? 0) + row.views,
        clicks: (before?.clicks ?? 0) + row.clicks,
      });
    }
    return [...byKey.values()];
  }
}
