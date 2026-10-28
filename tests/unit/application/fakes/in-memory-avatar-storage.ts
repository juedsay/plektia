import type { AvatarStorage } from "@/application/ports/avatar-storage";
import { err, ok, type Result } from "@/domain/result";

/** Bucket de avatares en memoria: recuerda qué se subió y qué se borró. */
export class InMemoryAvatarStorage implements AvatarStorage {
  readonly files = new Map<string, Uint8Array>();
  readonly removed: string[] = [];
  /** Si es `true`, la próxima subida la rechaza (políticas, tamaño, tipo). */
  rejectNextUpload = false;

  upload(path: string, bytes: Uint8Array): Promise<Result<void, "rejected">> {
    if (this.rejectNextUpload) {
      this.rejectNextUpload = false;
      return Promise.resolve(err("rejected"));
    }
    this.files.set(path, bytes);
    return Promise.resolve(ok(undefined));
  }

  remove(path: string): Promise<void> {
    this.files.delete(path);
    this.removed.push(path);
    return Promise.resolve();
  }
}
