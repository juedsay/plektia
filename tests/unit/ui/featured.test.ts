import { describe, expect, it } from "vitest";

import {
  featuredLabel,
  formatDuration,
  spokenDuration,
  thumbPath,
  timeAgo,
  watchLabel,
  watchUrl,
} from "@/ui/view/featured";

const NOW = new Date("2026-10-28T12:00:00Z");

describe("contenido destacado · presentación", () => {
  it("la etiqueta dice qué es, o 'Destacado' si está fijado", () => {
    expect(featuredLabel({ kind: "video", pinned: false })).toBe("Último video");
    expect(featuredLabel({ kind: "short", pinned: false })).toBe("Último Short");
    expect(featuredLabel({ kind: "stream", pinned: false })).toBe("Último directo");
    expect(featuredLabel({ kind: "short", pinned: true })).toBe("Destacado");
  });

  it.each([
    ["2026-10-26T12:00:00Z", "anteayer"],
    ["2026-10-27T11:00:00Z", "ayer"],
    ["2026-10-28T09:00:00Z", "hace 3 horas"],
    ["2026-10-28T11:55:00Z", "hace 5 minutos"],
    ["2026-10-28T11:59:30Z", "recién"],
    ["2026-10-14T12:00:00Z", "hace 2 semanas"],
    ["2025-09-01T12:00:00Z", "el año pasado"],
    ["2026-10-29T12:00:00Z", "recién"],
  ])("%s → %s", (date, expected) => {
    expect(timeAgo(date, NOW)).toBe(expected);
  });

  it("formatea la duración para ver y para escuchar", () => {
    expect(formatDuration(754)).toBe("12:34");
    expect(formatDuration(45)).toBe("0:45");
    expect(formatDuration(3723)).toBe("1:02:03");
    expect(spokenDuration(754)).toBe("12 minutos 34 segundos");
    expect(spokenDuration(3601)).toBe("1 hora 1 segundo");
    expect(spokenDuration(0)).toBe("0 segundos");
  });

  it("un Short se abre en su reproductor vertical; la miniatura sale del propio sitio", () => {
    expect(watchUrl({ videoId: "aBcDeFgHiJk", kind: "short" })).toBe(
      "https://www.youtube.com/shorts/aBcDeFgHiJk",
    );
    expect(watchUrl({ videoId: "aBcDeFgHiJk", kind: "stream" })).toBe(
      "https://www.youtube.com/watch?v=aBcDeFgHiJk",
    );
    expect(thumbPath("aBcDeFgHiJk")).toBe("/thumbs/aBcDeFgHiJk.jpg");
  });

  it("el nombre accesible del enlace incluye título y duración", () => {
    const featured = {
      videoId: "aBcDeFgHiJk",
      kind: "video",
      title: "Cómo testeo RLS",
      publishedAt: "2026-10-26T12:00:00Z",
      durationSeconds: 754,
      pinned: false,
    } as const;
    expect(watchLabel(featured)).toBe("Ver en YouTube: Cómo testeo RLS, 12 minutos 34 segundos");
    expect(watchLabel({ ...featured, durationSeconds: null })).toBe(
      "Ver en YouTube: Cómo testeo RLS",
    );
  });
});
