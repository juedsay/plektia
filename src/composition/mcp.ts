import { createClient } from "@supabase/supabase-js";

import type { McpCaller } from "@/application/ports/mcp-auth";
import type { PageCache } from "@/application/ports/page-cache";
import type { CheckLiveError, McpWorkspace } from "@/infrastructure/mcp/workspace";
import type { Result } from "@/domain/result";
import type { Database } from "@/infrastructure/supabase/database.types";
import {
  McpRpcLinkMedia,
  McpRpcLinkWriter,
  updatePageByMcp,
} from "@/infrastructure/supabase/mcp-rpc-writers";
import type { SupabaseConfig } from "@/infrastructure/supabase/server-client";
import { SupabaseLinkMediaRepository } from "@/infrastructure/supabase/supabase-link-media-repository";
import { SupabaseLinkRepository } from "@/infrastructure/supabase/supabase-link-repository";
import { SupabasePageRepository } from "@/infrastructure/supabase/supabase-page-repository";
import { SupabaseStatsReader } from "@/infrastructure/supabase/supabase-stats-reader";

/**
 * El espacio de trabajo de un cliente MCP verificado: un cliente de Supabase
 * con su token (nunca la `service_role`). Lee con la RLS como el dueño y
 * escribe por las funciones `mcp_*`, que vuelven a verificar el grant.
 */
export function createMcpWorkspace(
  config: SupabaseConfig,
  caller: McpCaller,
  options: {
    origin: string;
    cache: PageCache;
    checkLive: (ownerId: string) => Promise<Result<number, CheckLiveError>>;
  },
): McpWorkspace {
  const client = createClient<Database>(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${caller.accessToken}` } },
  });
  return {
    caller,
    origin: options.origin,
    pages: new SupabasePageRepository(client, caller.userId),
    linksOf: (pageId) => new SupabaseLinkRepository(client, pageId),
    writerOf: (pageId, confirmTitle) => new McpRpcLinkWriter(client, pageId, confirmTitle ?? null),
    mediaOf: (pageId) =>
      new McpRpcLinkMedia(client, new SupabaseLinkMediaRepository(client, pageId)),
    updatePage: (pageId, settings) => updatePageByMcp(client, pageId, settings),
    stats: new SupabaseStatsReader(client),
    purge: (handle) => options.cache.purgeProfile(handle),
    checkLive: () => options.checkLive(caller.userId),
    now: () => new Date(),
  };
}
