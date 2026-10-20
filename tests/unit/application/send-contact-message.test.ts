import { describe, expect, it } from "vitest";

import { sendContactMessage } from "@/application/contact/send-contact-message";
import type { ContactInbox, HumanVerifier } from "@/application/ports/contact";
import type { RateLimiter } from "@/application/ports/rate-limiter";
import type { ContactMessage } from "@/domain/contact";
import { err, ok } from "@/domain/result";

class FakeInbox implements ContactInbox {
  readonly saved: ContactMessage[] = [];
  constructor(private readonly full = false) {}
  save(message: ContactMessage) {
    if (this.full) return Promise.resolve(err("limit_reached" as const));
    this.saved.push(message);
    return Promise.resolve(ok(undefined));
  }
}

class FakeVerifier implements HumanVerifier {
  readonly calls: [string, string | null][] = [];
  constructor(private readonly human = true) {}
  verify(token: string, ip: string | null) {
    this.calls.push([token, ip]);
    return Promise.resolve(this.human);
  }
}

class FakeLimiter implements RateLimiter {
  readonly keys: string[] = [];
  constructor(private readonly allowed = true) {}
  allow(key: string) {
    this.keys.push(key);
    return Promise.resolve(this.allowed);
  }
}

const fields = { name: "Ana", email: "ana@example.com", message: "Quiero una invitación" };

function setup(options: { human?: boolean; allowed?: boolean; full?: boolean } = {}) {
  const inbox = new FakeInbox(options.full);
  const verifier = new FakeVerifier(options.human);
  const limiter = new FakeLimiter(options.allowed);
  return { inbox, verifier, limiter, send: sendContactMessage({ inbox, verifier, limiter }) };
}

describe("sendContactMessage", () => {
  it("guarda un mensaje válido de una persona verificada", async () => {
    const { send, inbox, verifier, limiter } = setup();
    expect(await send({ fields, turnstileToken: "tok", ip: "203.0.113.7" })).toEqual(ok(undefined));
    expect(inbox.saved).toEqual([fields]);
    expect(verifier.calls).toEqual([["tok", "203.0.113.7"]]);
    expect(limiter.keys).toEqual(["contacto:203.0.113.7"]);
  });

  it("pasado el límite por IP, rechaza sin verificar ni guardar", async () => {
    const { send, inbox, verifier } = setup({ allowed: false });
    expect(await send({ fields, turnstileToken: "tok", ip: "203.0.113.7" })).toEqual(
      err("rate_limited"),
    );
    expect(verifier.calls).toEqual([]);
    expect(inbox.saved).toEqual([]);
  });

  it("al bot que completa el campo trampa le dice que salió, pero no guarda", async () => {
    const { send, inbox, verifier } = setup();
    const bot = { ...fields, website: "https://spam.test" };
    expect(await send({ fields: bot, turnstileToken: "tok", ip: null })).toEqual(ok(undefined));
    expect(inbox.saved).toEqual([]);
    expect(verifier.calls).toEqual([]);
  });

  it("con datos inválidos no gasta la verificación", async () => {
    const { send, verifier } = setup();
    const result = await send({
      fields: { ...fields, email: "x" },
      turnstileToken: "tok",
      ip: null,
    });
    expect(result.ok).toBe(false);
    expect(verifier.calls).toEqual([]);
  });

  it.each([undefined, "", 42, "x".repeat(2049)])(
    "sin un token de Turnstile utilizable (%j) no es una persona",
    async (turnstileToken) => {
      const { send, inbox, verifier } = setup();
      expect(await send({ fields, turnstileToken, ip: null })).toEqual(err("not_human"));
      expect(verifier.calls).toEqual([]);
      expect(inbox.saved).toEqual([]);
    },
  );

  it("si Turnstile no lo verifica, no guarda", async () => {
    const { send, inbox } = setup({ human: false });
    expect(await send({ fields, turnstileToken: "tok", ip: null })).toEqual(err("not_human"));
    expect(inbox.saved).toEqual([]);
  });

  it("sin IP conocida, el límite se aplica a un balde común", async () => {
    const { send, limiter } = setup();
    await send({ fields, turnstileToken: "tok", ip: null });
    expect(limiter.keys).toEqual(["contacto:desconocida"]);
  });

  it("si la base frenó una inundación, lo informa", async () => {
    const { send } = setup({ full: true });
    expect(await send({ fields, turnstileToken: "tok", ip: null })).toEqual(err("limit_reached"));
  });
});
