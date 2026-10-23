import type { Page, PageReader } from "@/application/ports/page-repository";

export interface OwnPages {
  readonly pages: readonly Page[];
  /** La que abre el panel: la última usada o, si no hay, la primera que se creó. */
  readonly currentPageId: string | null;
}

export function listPages(deps: { pages: PageReader }) {
  return async (): Promise<OwnPages> => {
    const [pages, lastUsedPageId] = await Promise.all([
      deps.pages.listOwn(),
      deps.pages.lastUsedPageId(),
    ]);
    const lastUsed = pages.find((page) => page.id === lastUsedPageId);
    return { pages, currentPageId: (lastUsed ?? pages[0])?.id ?? null };
  };
}
