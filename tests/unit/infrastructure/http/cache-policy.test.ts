import { describe, expect, it } from "vitest";

import { cachePolicy, profileTag } from "@/infrastructure/http/cache-policy";

const get = (pathname: string, status = 200, setsCookie = false) =>
  cachePolicy({ pathname, method: "GET", status, setsCookie });

describe("cachePolicy", () => {
  it("un perfil se cachea un minuto, con su etiqueta en minúsculas", () => {
    expect(get("/juedsay")).toEqual({
      cacheControl: "public, max-age=60, stale-while-revalidate=300",
      tags: ["profile:juedsay"],
    });
    expect(get("/JuedSay").tags).toEqual(["profile:juedsay"]);
  });

  it("el 404 de un handle lleva la etiqueta del perfil (crearlo lo purga)", () => {
    expect(get("/nadie-existe", 404)).toEqual({
      cacheControl: "public, max-age=60",
      tags: ["profile:nadie-existe"],
    });
  });

  it.each(["/", "/legal/privacy", "/sitemap.xml", "/robots.txt"])(
    "%s es del sitio: cinco minutos y etiqueta site",
    (path) => {
      expect(get(path)).toEqual({
        cacheControl: "public, max-age=300, stale-while-revalidate=3600",
        tags: ["site"],
      });
    },
  );

  it("un avatar se cachea un año: uno nuevo siempre es otra ruta", () => {
    const avatar =
      "/avatars/22222222-2222-4222-8222-222222222222/0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.webp";
    expect(get(avatar)).toEqual({
      cacheControl: "public, max-age=31536000, immutable",
      tags: ["avatars"],
    });
    expect(get(avatar, 404).cacheControl).not.toContain("immutable");
    expect(get("/avatars/otra-cosa.png").cacheControl).toBe("private, no-store");
  });

  it("/plektia es la página oficial: como un perfil (la edita la Admin) y del sitio", () => {
    expect(get("/plektia")).toEqual({
      cacheControl: "public, max-age=60, stale-while-revalidate=300",
      tags: ["site", "profile:plektia"],
    });
  });

  it.each(["/login", "/auth/callback", "/admin", "/admin/perfil", "/contact", "/contacto"])(
    "%s nunca se cachea",
    (path) => {
      expect(get(path).cacheControl).toBe("private, no-store");
    },
  );

  it("una respuesta con cookie nunca se cachea, aunque sea un perfil", () => {
    expect(get("/juedsay", 200, true).cacheControl).toBe("private, no-store");
  });

  it.each([
    ["POST", 200],
    ["GET", 500],
    ["GET", 303],
    ["GET", 308],
  ])("%s con estado %i no se cachea", (method, status) => {
    expect(
      cachePolicy({ pathname: "/juedsay", method, status, setsCookie: false }).cacheControl,
    ).toBe("private, no-store");
  });

  it("los handles reservados o inválidos no son perfiles", () => {
    expect(get("/a", 404).tags).toEqual(["site"]);
    expect(get("/favicon.ico", 404).tags).toEqual(["site"]);
    expect(get("/%E0%A4%A", 404).tags).toEqual(["site"]);
  });

  it("una ruta desconocida con 200 no se cachea por defecto", () => {
    expect(get("/algo/raro").cacheControl).toBe("private, no-store");
  });
});

describe("profileTag", () => {
  it("normaliza a minúsculas", () => {
    expect(profileTag("JuedSay")).toBe("profile:juedsay");
  });
});
