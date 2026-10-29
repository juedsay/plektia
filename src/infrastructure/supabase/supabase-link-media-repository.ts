import type { SupabaseClient } from "@supabase/supabase-js";

import type { LinkMediaRepository, LinkMediaView } from "@/application/ports/link-media-repository";
import type { WriteError } from "@/application/ports/link-repository";
import {
  DEFAULT_LINK_MEDIA,
  FEATURED_MODES,
  type FeaturedMode,
  type LinkMedia,
} from "@/domain/link-media";
import { ok, type Result } from "@/domain/result";
import type { Database } from "@/infrastructure/supabase/database.types";
import { unexpectedDatabaseError, writeFailure } from "@/infrastructure/supabase/write-errors";

type Client = SupabaseClient<Database>;

const MEDIA_COLUMNS = "watch_live, featured_mode, pinned_video_id";

interface MediaRow {
  readonly watch_live: boolean;
  readonly featured_mode: string;
  readonly pinned_video_id: string | null;
}

/**
 * Configuración de medios de los links de una página, con el cliente de la
 * sesión: la RLS solo deja ver y cambiar la de los links propios.
 */
export class SupabaseLinkMediaRepository implements LinkMediaRepository {
  constructor(
    private readonly client: Client,
    private readonly pageId: string,
  ) {}

  async read(linkId: string): Promise<LinkMediaView | null> {
    const { data, error } = await this.client
      .from("links")
      .select(`id, provider, provider_handle, link_media_settings (${MEDIA_COLUMNS})`)
      .eq("id", linkId)
      .eq("page_id", this.pageId)
      .maybeSingle();
    if (error) throw unexpectedDatabaseError("link_media_settings", error);
    if (!data) return null;
    return {
      linkId: data.id,
      provider: data.provider,
      providerHandle: data.provider_handle,
      media: data.link_media_settings ? toMedia(data.link_media_settings) : DEFAULT_LINK_MEDIA,
    };
  }

  async save(linkId: string, media: LinkMedia): Promise<Result<LinkMedia, WriteError>> {
    const { data, error } = await this.client
      .from("link_media_settings")
      .upsert(
        {
          link_id: linkId,
          watch_live: media.watchLive,
          featured_mode: media.featuredMode,
          pinned_video_id: media.pinnedVideoId,
        },
        { onConflict: "link_id" },
      )
      .select(MEDIA_COLUMNS)
      .single();
    if (error) return writeFailure("link_media_settings", error);
    return ok(toMedia(data));
  }
}

export function toMedia(row: MediaRow): LinkMedia {
  return {
    watchLive: row.watch_live,
    featuredMode: isFeaturedMode(row.featured_mode) ? row.featured_mode : "latest_video",
    pinnedVideoId: row.pinned_video_id,
  };
}

function isFeaturedMode(value: string): value is FeaturedMode {
  return (FEATURED_MODES as readonly string[]).includes(value);
}
