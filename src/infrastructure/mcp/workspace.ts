import type { LinkMediaRepository } from "@/application/ports/link-media-repository";
import type {
  LinkReader,
  LinkWriter,
  SectionWriter,
  WriteError,
} from "@/application/ports/link-repository";
import type { McpCaller } from "@/application/ports/mcp-auth";
import type { Page, PageReader } from "@/application/ports/page-repository";
import type { StatsReader } from "@/application/ports/stats-reader";
import type { PageSettings } from "@/domain/page";
import type { Result } from "@/domain/result";

// Lo que las herramientas MCP pueden tocar, ya armado para quien llama: las
// lecturas van con su token (RLS) y las escrituras por las funciones `mcp_*`.
// Las herramientas no saben de Supabase ni de Cloudflare.

export type CheckLiveError = "rate_limited" | "unavailable";

export interface McpWorkspace {
  readonly caller: McpCaller;
  /** El origen público del sitio (para armar la URL de cada página). */
  readonly origin: string;
  readonly pages: PageReader;
  linksOf(pageId: string): LinkReader;
  /** Con `confirmTitle`, el título exacto que confirma un borrado. */
  writerOf(pageId: string, confirmTitle?: string): LinkWriter & SectionWriter;
  mediaOf(pageId: string): LinkMediaRepository;
  updatePage(
    pageId: string,
    settings: Pick<PageSettings, "displayName" | "bio">,
  ): Promise<Result<Page, WriteError>>;
  readonly stats: StatsReader;
  /** Purga la página pública después de un cambio (se ve al instante). */
  purge(handle: string): Promise<void>;
  /** "Comprobar ahora" de la cuenta: cuántos canales revisó. */
  checkLive(): Promise<Result<number, CheckLiveError>>;
  now(): Date;
}
