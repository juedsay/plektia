import type { PageCache } from "@/application/ports/page-cache";
import { profileTag } from "@/infrastructure/http/cache-policy";

type Purge = (options: { tags: string[] }) => Promise<{
  success: boolean;
  errors: readonly { code: number; message: string }[];
}>;

/**
 * Purga por etiqueta en la caché del Worker (ADR 0003). Una purga fallida no
 * rompe la edición que la pidió: lo cacheado vence solo en un minuto, así que
 * alcanza con dejar rastro. Sin caché (en local no existe), no hace nada.
 */
export class WorkerPageCache implements PageCache {
  constructor(private readonly purge: Purge | undefined) {}

  purgeProfile(handle: string): Promise<void> {
    return this.purgeTags([profileTag(handle)]);
  }

  purgeSite(): Promise<void> {
    return this.purgeTags(["site"]);
  }

  private async purgeTags(tags: string[]): Promise<void> {
    if (!this.purge) return;
    try {
      const result = await this.purge({ tags });
      if (!result.success) console.warn("cache: la purga falló", tags, result.errors);
    } catch (error) {
      console.warn("cache: la purga falló", tags, error);
    }
  }
}
