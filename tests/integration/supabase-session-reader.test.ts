import { createClient, type Session } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, inject, it, vi } from "vitest";

import { createSessionReader } from "@/composition/session";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

const supabase = inject("supabase");
const config = { url: supabase.url, publishableKey: supabase.publishableKey };
const OWNER_ID = "11111111-1111-4111-8111-111111111111";

type Jar = Map<string, string>;

function cookieHeader(jar: Jar): string {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function writerFor(jar: Jar) {
  return { set: (name: string, value: string) => jar.set(name, value) };
}

/** Sesión real del owner del seed, creada con la API admin de Supabase local. */
async function ownerSession(): Promise<Session> {
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "owner@plektia.test",
  });
  if (link.error) throw link.error;
  const anon = createClient(supabase.url, supabase.publishableKey, {
    auth: { persistSession: false },
  });
  const verified = await anon.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "magiclink",
  });
  if (verified.error || !verified.data.session) throw verified.error ?? new Error("sin sesión");
  return verified.data.session;
}

/** Cookies tal como las escribe @supabase/ssr para esa sesión. */
async function cookiesFor(session: Session): Promise<Jar> {
  const jar: Jar = new Map();
  const client = createSupabaseServerClient(config, null, writerFor(jar));
  const { error } = await client.auth.setSession(session);
  if (error) throw error;
  return jar;
}

/** Reescribe la sesión guardada en las cookies (para simular una manipulada). */
function tamper(jar: Jar, change: (session: Record<string, unknown>) => void): Jar {
  const names = [...jar.keys()].sort();
  const base = (names[0] ?? "").replace(/\.\d+$/, "");
  const raw = names.map((name) => jar.get(name) ?? "").join("");
  const session = JSON.parse(
    Buffer.from(raw.replace(/^base64-/, ""), "base64url").toString("utf8"),
  ) as Record<string, unknown>;
  change(session);
  const encoded = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  return new Map([[base, encoded]]);
}

function readerFor(jar: Jar) {
  const request = new Request("https://app.invalid/admin", {
    headers: { cookie: cookieHeader(jar) },
  });
  return createSessionReader(config, request, writerFor(new Map()));
}

describe("SupabaseSessionReader contra Supabase local", () => {
  let session: Session;

  beforeAll(async () => {
    session = await ownerSession();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("con un token válido devuelve el usuario", async () => {
    const user = await readerFor(await cookiesFor(session)).getCurrentUser();
    expect(user).toEqual({ id: OWNER_ID, email: "owner@plektia.test" });
  });

  it("sin cookies no hay sesión", async () => {
    expect(await readerFor(new Map()).getCurrentUser()).toBeNull();
  });

  it("con la firma del token alterada no hay sesión", async () => {
    const jar = tamper(await cookiesFor(session), (sessionData) => {
      const token = String(sessionData["access_token"]);
      const replacementChar = token.at(-2) === "A" ? "B" : "A";
      sessionData["access_token"] = `${token.slice(0, -2)}${replacementChar}${token.slice(-1)}`;
      sessionData["refresh_token"] = "invalido";
    });
    expect(await readerFor(jar).getCurrentUser()).toBeNull();
  });

  it("con el usuario cambiado en el token (sin volver a firmar) no hay sesión", async () => {
    const jar = tamper(await cookiesFor(session), (sessionData) => {
      const [header, payload, signature] = String(sessionData["access_token"]).split(".");
      const claims = JSON.parse(Buffer.from(payload ?? "", "base64url").toString("utf8")) as Record<
        string,
        unknown
      >;
      claims["sub"] = "22222222-2222-4222-8222-222222222222";
      sessionData["access_token"] = [
        header,
        Buffer.from(JSON.stringify(claims)).toString("base64url"),
        signature,
      ].join(".");
      sessionData["refresh_token"] = "invalido";
    });
    expect(await readerFor(jar).getCurrentUser()).toBeNull();
  });

  it("con el token vencido y sin poder renovarlo no hay sesión", async () => {
    const jar = tamper(await cookiesFor(session), (sessionData) => {
      sessionData["refresh_token"] = "invalido";
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000);
    expect(await readerFor(jar).getCurrentUser()).toBeNull();
  });
});
