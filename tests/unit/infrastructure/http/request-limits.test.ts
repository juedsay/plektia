import { describe, expect, it } from "vitest";

import {
  AVATAR_UPLOAD_LIMIT,
  checkBodySize,
  DEFAULT_BODY_LIMIT,
} from "@/infrastructure/http/request-limits";

const post = (pathname: string, contentLength: string | null, search = "") =>
  checkBodySize({ method: "POST", pathname, contentLength, search });

describe("checkBodySize", () => {
  it("lo que no manda cuerpo (GET, HEAD, DELETE) pasa", () => {
    for (const method of ["GET", "HEAD", "DELETE"]) {
      expect(
        checkBodySize({
          method,
          pathname: "/_actions/links.list",
          contentLength: null,
          search: "",
        }),
      ).toEqual({ ok: true });
    }
  });

  it("un envío sin largo declarado (o con uno inválido) se rechaza con 411", () => {
    expect(post("/_actions/links.create", null)).toEqual({ ok: false, status: 411 });
    expect(post("/_actions/links.create", "-1")).toEqual({ ok: false, status: 411 });
    expect(post("/_actions/links.create", "mucho")).toEqual({ ok: false, status: 411 });
  });

  it("un envío común hasta 64 KB pasa; más, 413", () => {
    expect(post("/_actions/links.create", String(DEFAULT_BODY_LIMIT))).toEqual({ ok: true });
    expect(post("/contact", String(DEFAULT_BODY_LIMIT + 1))).toEqual({ ok: false, status: 413 });
  });

  it("la subida del avatar tiene su propio límite (256 KB), también como acción de formulario", () => {
    expect(post("/_actions/pages.setAvatar", String(AVATAR_UPLOAD_LIMIT))).toEqual({ ok: true });
    expect(post("/_actions/pages.setAvatar", String(AVATAR_UPLOAD_LIMIT + 1))).toEqual({
      ok: false,
      status: 413,
    });
    expect(post("/admin/page", String(200 * 1024), "?_action=pages.setAvatar")).toEqual({
      ok: true,
    });
    expect(post("/admin/page", String(200 * 1024))).toEqual({ ok: false, status: 413 });
  });

  it("un archivo de 10 MB se corta sin leerlo", () => {
    expect(post("/_actions/pages.setAvatar", String(10 * 1024 * 1024))).toEqual({
      ok: false,
      status: 413,
    });
  });
});
