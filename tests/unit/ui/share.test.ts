import { describe, expect, it, vi } from "vitest";

import { shareMessage, shareOrCopy } from "@/ui/scripts/share";

const data = { title: "juedsay · Plektia", url: "https://app.plektia.workers.dev/juedsay" };
const clipboard = () => ({ writeText: vi.fn(() => Promise.resolve()) });

describe("shareOrCopy", () => {
  it("usa la hoja nativa si existe", async () => {
    const share = vi.fn(() => Promise.resolve());
    const board = clipboard();
    expect(await shareOrCopy(data, { share, clipboard: board })).toBe("shared");
    expect(share).toHaveBeenCalledWith(data);
    expect(board.writeText).not.toHaveBeenCalled();
  });

  it("si la persona cierra la hoja, no copia ni avisa", async () => {
    const share = () => Promise.reject(new DOMException("cerrada", "AbortError"));
    const board = clipboard();
    expect(await shareOrCopy(data, { share, clipboard: board })).toBe("cancelled");
    expect(board.writeText).not.toHaveBeenCalled();
  });

  it("si la hoja falla por otra razón, copia el link", async () => {
    const share = () => Promise.reject(new DOMException("no", "NotAllowedError"));
    const board = clipboard();
    expect(await shareOrCopy(data, { share, clipboard: board })).toBe("copied");
    expect(board.writeText).toHaveBeenCalledWith(data.url);
  });

  it("sin hoja nativa copia el link", async () => {
    expect(await shareOrCopy(data, { clipboard: clipboard() })).toBe("copied");
  });

  it("si tampoco se puede copiar, avisa que falló", async () => {
    expect(await shareOrCopy(data, {})).toBe("failed");
    const board = { writeText: () => Promise.reject(new Error("sin permiso")) };
    expect(await shareOrCopy(data, { clipboard: board })).toBe("failed");
  });
});

describe("shareMessage", () => {
  it("avisa al copiar y al fallar, y calla en el resto", () => {
    expect(shareMessage("copied")).toBe("Link copiado");
    expect(shareMessage("failed")).toMatch(/barra de direcciones/);
    expect(shareMessage("shared")).toBeNull();
    expect(shareMessage("cancelled")).toBeNull();
  });
});
