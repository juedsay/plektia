import type { WriteError } from "@/application/ports/link-repository";
import type {
  Page,
  PageReader,
  PageWriteError,
  PageWriter,
} from "@/application/ports/page-repository";
import { PAGE_LIMIT, type PageDraft, type PageSettings } from "@/domain/page";
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

  /** Una página creada "a la vez" por otro pedido (simula el doble envío simultáneo). */
  createdByConcurrentRequest: Page | null = null;

  createPage(draft: PageDraft, id?: string): Promise<Result<Page, PageWriteError>> {
    if (this.createdByConcurrentRequest) {
      this.pages.push(this.createdByConcurrentRequest);
      this.createdByConcurrentRequest = null;
    }
    if (this.pages.length >= PAGE_LIMIT) return Promise.resolve(err("limit_reached"));
    const handleInUse =
      this.takenHandles.has(draft.handle) ||
      this.pages.some((page) => page.handle === draft.handle || page.id === id);
    if (handleInUse) return Promise.resolve(err("handle_taken"));
    const page: Page = {
      id: id ?? `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, "0")}`,
      handle: draft.handle,
      displayName: draft.displayName,
      bio: null,
      theme: "tecnico",
      showHandle: true,
      avatarPath: null,
    };
    this.pages.push(page);
    return Promise.resolve(ok(page));
  }

  updatePageSettings(pageId: string, settings: PageSettings): Promise<Result<Page, WriteError>> {
    const index = this.pages.findIndex((page) => page.id === pageId);
    const current = this.pages[index];
    if (!current) return Promise.resolve(err("not_found"));
    const updated: Page = { ...current, ...settings };
    this.pages[index] = updated;
    return Promise.resolve(ok(updated));
  }

  /** Si está, el próximo `setAvatar` falla con este error (como si la base lo rechazara). */
  nextAvatarFailure: WriteError | null = null;

  setAvatar(pageId: string, avatarPath: string | null): Promise<Result<Page, WriteError>> {
    if (this.nextAvatarFailure) {
      const failure = this.nextAvatarFailure;
      this.nextAvatarFailure = null;
      return Promise.resolve(err(failure));
    }
    const index = this.pages.findIndex((page) => page.id === pageId);
    const current = this.pages[index];
    if (!current) return Promise.resolve(err("not_found"));
    const updated: Page = { ...current, avatarPath };
    this.pages[index] = updated;
    return Promise.resolve(ok(updated));
  }

  rememberLastPage(pageId: string): Promise<Result<void, WriteError>> {
    if (!this.pages.some((page) => page.id === pageId)) return Promise.resolve(err("not_found"));
    this.lastUsed = pageId;
    return Promise.resolve(ok(undefined));
  }
}
