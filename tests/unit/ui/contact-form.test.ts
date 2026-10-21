import { describe, expect, it } from "vitest";

import {
  parseDraft,
  serializeDraft,
  shouldRestoreDraft,
  validateContact,
  validateField,
} from "@/ui/view/contact-form";

const valid = { name: "Ana", email: "ana@example.com", message: "Hola" };
const empty = { name: "", email: "", message: "" };

describe("validación en el navegador", () => {
  it("un formulario válido no tiene errores", () => {
    expect(validateContact(valid)).toEqual({});
  });

  it("usa los mismos mensajes que el servidor", () => {
    expect(validateContact({ ...valid, email: "testmail.com" })).toEqual({
      email: "Revisá tu email: no parece válido.",
    });
  });

  it("marca todos los campos vacíos al enviar", () => {
    expect(Object.keys(validateContact(empty)).sort()).toEqual(["email", "message", "name"]);
  });

  it("al salir de un campo solo informa ese campo", () => {
    const values = { ...empty, name: "Ana" };
    expect(validateField("name", values)).toBeNull();
    expect(validateField("email", values)).toMatch(/email/i);
  });
});

describe("borrador", () => {
  it("ida y vuelta", () => {
    expect(parseDraft(serializeDraft(valid))).toEqual(valid);
  });

  it.each([
    [null],
    [""],
    ["no es json"],
    ["[]"],
    ["null"],
    [JSON.stringify({ name: 1, email: "", message: "" })],
    [JSON.stringify({ name: "Ana" })],
    [JSON.stringify({ ...valid, message: "a".repeat(2001) })],
    [JSON.stringify(empty)],
  ])("descarta lo que no es un borrador válido (%j)", (raw) => {
    expect(parseDraft(raw)).toBeNull();
  });

  it("solo se restaura sobre un formulario vacío", () => {
    expect(shouldRestoreDraft(empty)).toBe(true);
    expect(shouldRestoreDraft({ ...empty, email: "x" })).toBe(false);
  });
});
