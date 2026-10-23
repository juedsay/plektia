import type { WriteError } from "@/application/ports/link-repository";
import type { PageDraft } from "@/domain/page";
import type { Result } from "@/domain/result";

// Puertos de las páginas de una cuenta (SPEC-pages). Como en los links, el
// dueño nunca es un parámetro: sale de la sesión y la base lo exige con RLS.

export interface Page {
  readonly id: string;
  readonly handle: string;
  readonly displayName: string;
  readonly bio: string | null;
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
  createPage(draft: PageDraft): Promise<Result<Page, PageWriteError>>;
  /** Recuerda la página elegida para abrirla al volver al panel. */
  rememberLastPage(pageId: string): Promise<Result<void, WriteError>>;
}
