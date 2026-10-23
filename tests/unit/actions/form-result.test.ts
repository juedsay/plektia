import { describe, expect, it } from "vitest";

import { formFields, toFormResult } from "@/actions/form-result";
import { errorMessage, invalidInput } from "@/domain/errors";
import { err, ok } from "@/domain/result";

describe("toFormResult", () => {
  it("si salió bien, devuelve el valor", () => {
    expect(toFormResult(ok({ id: "p1" }))).toEqual({ ok: true, value: { id: "p1" } });
  });

  it("un error del repositorio trae el mensaje del mapa y lo enviado", () => {
    expect(toFormResult(err("limit_reached"), { handle: "x" })).toEqual({
      ok: false,
      message: errorMessage("limit_reached"),
      fields: {},
      values: { handle: "x" },
    });
  });

  it("un error de validación trae el mensaje de cada campo", () => {
    const result = toFormResult(err(invalidInput({ handle: "Ese nombre está reservado." })));
    expect(result).toEqual({
      ok: false,
      message: errorMessage("invalid_input"),
      fields: { handle: "Ese nombre está reservado." },
      values: {},
    });
  });
});

describe("formFields", () => {
  it("toma los campos de texto y deja afuera los archivos", () => {
    const form = new FormData();
    form.set("handle", "mi-pagina");
    form.set("avatar", new File(["x"], "a.webp"));
    expect(formFields(form)).toEqual({ handle: "mi-pagina" });
  });
});
