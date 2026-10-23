import type { PageCache } from "@/application/ports/page-cache";

/** Caché falsa que anota qué se purgó, para verificar que cada edición purga lo suyo. */
export class RecordingPageCache implements PageCache {
  readonly purged: string[] = [];

  purgeProfile(handle: string): Promise<void> {
    this.purged.push(`profile:${handle}`);
    return Promise.resolve();
  }

  purgeSite(): Promise<void> {
    this.purged.push("site");
    return Promise.resolve();
  }
}
