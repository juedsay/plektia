import { beforeEach, describe, expect, it } from "vitest";

import {
  removeLinkPreviewImage,
  setLinkPreviewImage,
} from "@/application/links/link-preview-image";
import type { Link } from "@/application/ports/link-repository";
import { PREVIEW_IMAGE_MAX_BYTES } from "@/domain/link-preview-image";

import { jpeg, PNG_SIGNATURE, webp } from "../../support/webp";
import { InMemoryAvatarStorage } from "./fakes/in-memory-avatar-storage";
import { InMemoryLinkRepository } from "./fakes/in-memory-link-repository";

const OWNER = "22222222-2222-4222-8222-222222222222";

let links: InMemoryLinkRepository;
let images: InMemoryAvatarStorage;
let link: Link;
let fileNumber: number;

const preview = (bytes: Uint8Array, size = bytes.length) => ({
  size,
  bytes: () => Promise.resolve(bytes),
});
const setImage = () =>
  setLinkPreviewImage({
    links,
    images,
    ownerId: OWNER,
    newFileId: () => `0b1d2c3e-4f5a-4b6c-8d7e-${String(++fileNumber).padStart(12, "0")}`,
  });
const target = () => ({ id: link.id, version: link.version });

beforeEach(async () => {
  links = new InMemoryLinkRepository();
  images = new InMemoryAvatarStorage();
  fileNumber = 0;
  const created = await links.createLink({
    title: "Nota",
    url: "https://medium.com/@juedsay/una-nota",
    description: null,
    tags: [],
    sectionId: null,
    visible: true,
    provider: "generic",
    providerHandle: null,
    kind: null,
  });
  if (!created.ok) throw new Error("no se pudo crear el link");
  link = created.value;
});

describe("setLinkPreviewImage", () => {
  it("sube la imagen de 480 × 252 a la carpeta de la cuenta y la pone en el link", async () => {
    const result = await setImage()(target(), preview(webp({ width: 480, height: 252 })));
    const path = `${OWNER}/0b1d2c3e-4f5a-4b6c-8d7e-000000000001.webp`;
    expect(result).toMatchObject({ ok: true, value: { previewImagePath: path } });
    expect([...images.files.keys()]).toEqual([path]);
  });

  it("acepta JPEG (Safari) y al cambiarla borra la anterior", async () => {
    const first = await setImage()(target(), preview(webp({ width: 480, height: 252 })));
    if (!first.ok) throw new Error("no se guardó");
    const second = await setImage()(
      { id: link.id, version: first.value.version },
      preview(jpeg({ width: 480, height: 252 })),
    );
    expect(second.ok && second.value.previewImagePath).toMatch(/000000000002\.jpg$/);
    expect(images.removed).toEqual([first.value.previewImagePath]);
  });

  it.each([
    ["otro tamaño", webp({ width: 512, height: 512 }), "480 × 252"],
    ["un PNG sin re-codificar", PNG_SIGNATURE, "No pudimos leer"],
    ["animada", webp({ width: 480, height: 252, chunk: "VP8X", flags: 0x02 }), "animada"],
  ])("rechaza %s sin subir nada", async (_case, bytes, message) => {
    const result = await setImage()(target(), preview(bytes));
    expect(result.ok).toBe(false);
    if (!result.ok && typeof result.error !== "string") {
      expect(result.error.fields["image"]).toContain(message);
    }
    expect(images.files.size).toBe(0);
  });

  it("un archivo más pesado que el máximo se rechaza sin leerlo", async () => {
    const result = await setImage()(target(), {
      size: PREVIEW_IMAGE_MAX_BYTES + 1,
      bytes: () => Promise.reject(new Error("no debería leerse")),
    });
    expect(result.ok).toBe(false);
  });

  it("un link ajeno o una versión vieja no dejan archivos huérfanos", async () => {
    expect(
      await setImage()({ id: "9b1d2c3e-4f5a-4b6c-8d7e-000000000000", version: 1 }, preview(webp())),
    ).toEqual({ ok: false, error: "not_found" });
    const stale = await setImage()(
      { id: link.id, version: link.version + 5 },
      preview(webp({ width: 480, height: 252 })),
    );
    expect(stale).toEqual({ ok: false, error: "conflict" });
    expect(images.files.size).toBe(0);
  });
});

describe("removeLinkPreviewImage", () => {
  it("saca la imagen y borra el archivo; sin imagen, no hace nada", async () => {
    const saved = await setImage()(target(), preview(webp({ width: 480, height: 252 })));
    if (!saved.ok) throw new Error("no se guardó");
    const removed = await removeLinkPreviewImage({ links, images })({
      id: link.id,
      version: saved.value.version,
    });
    expect(removed).toMatchObject({ ok: true, value: { previewImagePath: null } });
    expect(images.removed).toEqual([saved.value.previewImagePath]);

    const again = await removeLinkPreviewImage({ links, images })({
      id: link.id,
      version: saved.value.version + 1,
    });
    expect(again.ok).toBe(true);
    expect(images.removed).toHaveLength(1);
  });
});
