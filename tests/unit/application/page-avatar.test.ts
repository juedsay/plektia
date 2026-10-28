import { beforeEach, describe, expect, it } from "vitest";

import { createPage } from "@/application/pages/create-page";
import { removePageAvatar, setPageAvatar } from "@/application/pages/set-page-avatar";
import type { Page } from "@/application/ports/page-repository";
import { AVATAR_MAX_BYTES } from "@/domain/avatar";

import { PNG_SIGNATURE, SVG_WITH_SCRIPT, webp } from "../../support/webp";
import { InMemoryAvatarStorage } from "./fakes/in-memory-avatar-storage";
import { InMemoryPageRepository } from "./fakes/in-memory-page-repository";
import { RecordingPageCache } from "./fakes/recording-page-cache";

const OWNER = "22222222-2222-4222-8222-222222222222";

let pages: InMemoryPageRepository;
let avatars: InMemoryAvatarStorage;
let cache: RecordingPageCache;
let page: Page;
let fileNumber: number;

const image = (bytes: Uint8Array, size = bytes.length) => ({
  size,
  bytes: () => Promise.resolve(bytes),
});

const setAvatar = () =>
  setPageAvatar({
    pages,
    avatars,
    cache,
    ownerId: OWNER,
    newFileId: () => `0b1d2c3e-4f5a-4b6c-8d7e-${String(++fileNumber).padStart(12, "0")}`,
  });

beforeEach(async () => {
  pages = new InMemoryPageRepository();
  avatars = new InMemoryAvatarStorage();
  cache = new RecordingPageCache();
  fileNumber = 0;
  const created = await createPage({ pages, cache })({ handle: "miembro", displayName: "Miembro" });
  if (!created.ok) throw new Error("no se pudo crear la página");
  page = created.value;
  cache.purged.length = 0;
});

describe("setPageAvatar", () => {
  it("sube el WebP a la carpeta de la cuenta, lo pone en la página y purga la pública", async () => {
    const result = await setAvatar()({ pageId: page.id }, image(webp()));
    const expectedPath = `${OWNER}/0b1d2c3e-4f5a-4b6c-8d7e-000000000001.webp`;
    expect(result).toMatchObject({ ok: true, value: { avatarPath: expectedPath } });
    expect([...avatars.files.keys()]).toEqual([expectedPath]);
    expect(cache.purged).toEqual(["profile:miembro"]);
  });

  it("al cambiarlo, el archivo anterior se borra", async () => {
    await setAvatar()({ pageId: page.id }, image(webp()));
    const second = await setAvatar()({ pageId: page.id }, image(webp({ chunk: "VP8 " })));
    expect(second.ok && second.value.avatarPath).toBe(
      `${OWNER}/0b1d2c3e-4f5a-4b6c-8d7e-000000000002.webp`,
    );
    expect(avatars.removed).toEqual([`${OWNER}/0b1d2c3e-4f5a-4b6c-8d7e-000000000001.webp`]);
    expect(avatars.files.size).toBe(1);
  });

  it.each([
    ["un SVG con un script", SVG_WITH_SCRIPT],
    ["un PNG renombrado", PNG_SIGNATURE],
    ["un WebP de 4000 × 4000", webp({ width: 4000, height: 4000 })],
  ])("rechaza %s sin subir nada", async (_caso, bytes) => {
    const result = await setAvatar()({ pageId: page.id }, image(bytes));
    expect(result).toMatchObject({ ok: false, error: { kind: "invalid_input" } });
    expect(avatars.files.size).toBe(0);
  });

  it("un archivo de 10 MB se rechaza sin leerlo", async () => {
    let read = false;
    const huge = {
      size: 10 * 1024 * 1024,
      bytes: () => {
        read = true;
        return Promise.resolve(new Uint8Array());
      },
    };
    const result = await setAvatar()({ pageId: page.id }, huge);
    expect(result).toMatchObject({ ok: false, error: { kind: "invalid_input" } });
    expect(read).toBe(false);
  });

  it("si el peso declarado miente, lo frena la validación de los bytes", async () => {
    const result = await setAvatar()(
      { pageId: page.id },
      image(webp({ totalBytes: AVATAR_MAX_BYTES + 10 }), 100),
    );
    expect(result).toMatchObject({ ok: false, error: { kind: "invalid_input" } });
  });

  it("sin imagen, lo pide junto al campo", async () => {
    expect(await setAvatar()({ pageId: page.id }, null)).toEqual({
      ok: false,
      error: { kind: "invalid_input", fields: { avatar: "Elegí una imagen." } },
    });
  });

  it("la página de otra cuenta (o un id inválido) no se toca", async () => {
    expect(
      await setAvatar()({ pageId: "9a9e0000-0000-4000-8000-000000000099" }, image(webp())),
    ).toEqual({ ok: false, error: "not_found" });
    expect((await setAvatar()({ pageId: "x" }, image(webp()))).ok).toBe(false);
    expect(avatars.files.size).toBe(0);
  });

  it("si Storage rechaza la subida, la página queda como estaba", async () => {
    avatars.rejectNextUpload = true;
    const result = await setAvatar()({ pageId: page.id }, image(webp()));
    expect(result).toMatchObject({ ok: false, error: { kind: "invalid_input" } });
    expect(pages.pages[0]?.avatarPath).toBeNull();
  });

  it("si la página no se pudo actualizar, el archivo nuevo no queda huérfano", async () => {
    pages.nextAvatarFailure = "forbidden";
    const result = await setAvatar()({ pageId: page.id }, image(webp()));
    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(avatars.files.size).toBe(0);
    expect(cache.purged).toEqual([]);
  });
});

describe("removePageAvatar", () => {
  it("saca el avatar, borra el archivo y purga la pública", async () => {
    await setAvatar()({ pageId: page.id }, image(webp()));
    cache.purged.length = 0;
    const result = await removePageAvatar({ pages, avatars, cache })({ pageId: page.id });
    expect(result).toMatchObject({ ok: true, value: { avatarPath: null } });
    expect(avatars.files.size).toBe(0);
    expect(cache.purged).toEqual(["profile:miembro"]);
  });

  it("sin avatar, no hace nada y sale bien (idempotente)", async () => {
    const result = await removePageAvatar({ pages, avatars, cache })({ pageId: page.id });
    expect(result).toMatchObject({ ok: true, value: { avatarPath: null } });
    expect(avatars.removed).toEqual([]);
    expect(cache.purged).toEqual([]);
  });

  it("la página de otra cuenta no se toca; si la base lo rechaza, el archivo sigue", async () => {
    expect(
      await removePageAvatar({ pages, avatars, cache })({
        pageId: "9a9e0000-0000-4000-8000-000000000099",
      }),
    ).toEqual({ ok: false, error: "not_found" });

    await setAvatar()({ pageId: page.id }, image(webp()));
    pages.nextAvatarFailure = "forbidden";
    expect(await removePageAvatar({ pages, avatars, cache })({ pageId: page.id })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(avatars.files.size).toBe(1);
  });
});
