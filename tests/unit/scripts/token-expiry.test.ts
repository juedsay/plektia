import { describe, expect, it } from "vitest";

import {
  CI_TOKENS,
  checkToken,
  daysBetween,
  issueBody,
  issueTitle,
} from "../../../scripts/token-expiry";

const [supabase, cloudflare] = CI_TOKENS;
if (!supabase || !cloudflare) throw new Error("faltan tokens");

describe("daysBetween", () => {
  it("cuenta días enteros en UTC, incluso cruzando el año", () => {
    expect(daysBetween("2026-12-30", "2027-01-13")).toBe(14);
    expect(daysBetween("2027-01-13", "2027-01-13")).toBe(0);
    expect(daysBetween("2027-01-14", "2027-01-13")).toBe(-1);
  });

  it("rechaza lo que no es una fecha AAAA-MM-DD real", () => {
    expect(daysBetween("2027-01-01", "13/01/2027")).toBeNull();
    expect(daysBetween("2027-01-01", "2027-02-30")).toBeNull();
    expect(daysBetween("ayer", "2027-01-01")).toBeNull();
  });
});

describe("checkToken", () => {
  it("avisa desde 14 días antes; antes de eso, nada", () => {
    expect(checkToken(supabase, "2027-01-13", "2026-12-29")).toMatchObject({
      status: "ok",
      daysLeft: 15,
    });
    expect(checkToken(supabase, "2027-01-13", "2026-12-30")).toMatchObject({
      status: "soon",
      daysLeft: 14,
    });
    expect(checkToken(supabase, "2027-01-13", "2027-01-13")).toMatchObject({ status: "soon" });
  });

  it("vencido, faltante o mal escrito se distingue", () => {
    expect(checkToken(cloudflare, "2027-10-14", "2027-10-20")).toMatchObject({
      status: "expired",
      daysLeft: -6,
    });
    expect(checkToken(cloudflare, undefined, "2027-01-01")).toMatchObject({ status: "missing" });
    expect(checkToken(cloudflare, " ", "2027-01-01")).toMatchObject({ status: "missing" });
    expect(checkToken(cloudflare, "14/10/2027", "2027-01-01")).toMatchObject({
      status: "invalid",
    });
  });
});

describe("issue", () => {
  it("título fijo por token (la clave para no duplicar) y cuerpo con el comando", () => {
    expect(issueTitle(supabase)).toBe(issueTitle(supabase));
    expect(issueTitle(supabase)).not.toBe(issueTitle(cloudflare));
    const check = checkToken(supabase, "2027-01-13", "2027-01-03");
    if (check.status !== "soon") throw new Error("esperaba soon");
    const body = issueBody(check);
    expect(body).toContain("2027-01-13");
    expect(body).toContain("en 10 días");
    expect(body).toContain("bash scripts/renovar-token.sh supabase");
  });

  it("si ya venció, lo dice", () => {
    const check = checkToken(cloudflare, "2027-10-14", "2027-10-15");
    if (check.status !== "expired") throw new Error("esperaba expired");
    expect(issueBody(check)).toContain("Venció el 2027-10-14");
  });
});
