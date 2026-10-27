import type { WriteError } from "@/application/ports/link-repository";
import type { PageDraft, PageSettings, Theme } from "@/domain/page";
import type { Result } from "@/domain/result";

// Puertos de las páginas de una cuenta (SPEC-pages). Como en los links, el
// dueño nunca es un parámetro: sale de la sesión y la base lo exige con RLS.

export interface Page {
  readonly id: string;
  readonly handle: string;
  readonly displayName: string;
  readonly bio: string | null;
  readonly theme: Theme;
  readonly showHandle: boolean;
}

/** Además de los de escritura, el handle puede estar usado por otra página. */
export type PageWriteError = WriteError | "handle_taken";

export interface PageReader {
  /** Las páginas del usuario de la sesión, de la más vieja a la más nueva. */
  listOwn(): Promise<readonly Page[]>;
  /** La última página que usó, o `null` si nunca eligió una. */
  lastUsedPageId(): Promise<string | null>;
}

export interface PageWriter {
  /** Con `id`, el alta va con ese id (el caso de uso devuelve la existente si se repite). */
  createPage(draft: PageDraft, id?: string): Promise<Result<Page, PageWriteError>>;
  /** Cambia el nombre, la bio, el tema y si se muestra el @handle de una página propia. */
  updatePageSettings(pageId: string, settings: PageSettings): Promise<Result<Page, WriteError>>;
  /** Recuerda la página elegida para abrirla al volver al panel. */
  rememberLastPage(pageId: string): Promise<Result<void, WriteError>>;
}
