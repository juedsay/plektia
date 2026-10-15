import { describe, expect, it } from "vitest";

import { readForm } from "@/infrastructure/http/form";

describe("readForm", () => {
  it("lee un formulario", async () => {
    const request = new Request("https://app.invalid/x", {
      method: "POST",
      body: new URLSearchParams({ provider: "github" }),
    });
    expect((await readForm(request)).get("provider")).toBe("github");
  });

  it.each([
    ["sin cuerpo", undefined, undefined],
    ["con JSON", JSON.stringify({ provider: "github" }), "application/json"],
    ["con un multipart roto", "basura", "multipart/form-data; boundary=x"],
  ])("%s devuelve un formulario vacío", async (_caso, body, type) => {
    const request = new Request("https://app.invalid/x", {
      method: "POST",
      ...(body === undefined ? {} : { body }),
      ...(type === undefined ? {} : { headers: { "Content-Type": type } }),
    });
    expect([...(await readForm(request)).keys()]).toEqual([]);
  });
});
