import type { WriteError } from "@/application/ports/link-repository";
import type {
  Page,
  PageReader,
  PageWriteError,
  PageWriter,
} from "@/application/ports/page-repository";
import { PAGE_LIMIT, type PageDraft } from "@/domain/page";
import { err, ok, type Result } from "@/domain/result";

/**
 * Páginas en memoria para los tests de casos de uso: imita el límite, el handle
 * único y que la última página usada sea propia. Las garantías reales las
 * prueban pgTAP y los tests de integración.
 */
export class InMemoryPageRepository implements PageReader, PageWriter {
  pages: Page[] = [];
  /** Handles de páginas de otras cuentas. */
  takenHandles = new Set<string>();
  lastUsed: string | null = null;
  private nextId = 1;

  listOwn(): Promise<readonly Page[]> {
    return Promise.resolve([...this.pages]);
  }

  lastUsedPageId(): Promise<string | null> {
    return Promise.resolve(this.lastUsed);
  }

  createPage(draft: PageDraft): Promise<Result<Page, PageWriteError>> {
    if (this.pages.length >= PAGE_LIMIT) return Promise.resolve(err("limit_reached"));
    const handleInUse =
      this.takenHandles.has(draft.handle) ||
      this.pages.some((page) => page.handle === draft.handle);
    if (handleInUse) return Promise.resolve(err("handle_taken"));
    const page: Page = {
      id: `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, "0")}`,
      handle: draft.handle,
      displayName: draft.displayName,
      bio: null,
      showHandle: true,
    };
    this.pages.push(page);
    return Promise.resolve(ok(page));
  }

  rememberLastPage(pageId: string): Promise<Result<void, WriteError>> {
    if (!this.pages.some((page) => page.id === pageId)) return Promise.resolve(err("not_found"));
    this.lastUsed = pageId;
    return Promise.resolve(ok(undefined));
  }
}
