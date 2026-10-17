import { describe, expect, it } from "vitest";

import { invalidInput } from "@/domain/errors";
import { contactFeedback } from "@/ui/view/contact";

describe("contactFeedback", () => {
  it("antes de enviar no hay avisos", () => {
    expect(contactFeedback(null)).toEqual({ status: 200, summary: null, fields: {} });
  });

  it("los errores de validación van junto a cada campo", () => {
    const feedback = contactFeedback(invalidInput({ email: "Revisá tu email." }));
    expect(feedback.status).toBe(400);
    expect(feedback.fields).toEqual({ email: "Revisá tu email." });
  });

  it.each([
    ["rate_limited", 429],
    ["not_human", 400],
    ["limit_reached", 503],
  ] as const)("%s responde %i con un aviso general", (error, status) => {
    const feedback = contactFeedback(error);
    expect(feedback.status).toBe(status);
    expect(feedback.summary).toBeTruthy();
    expect(feedback.fields).toEqual({});
  });
});
