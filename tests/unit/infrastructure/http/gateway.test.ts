import { describe, expect, it } from "vitest";

import { cacheKeyFor, COUNTRY_HEADER, forwardedRequest } from "@/infrastructure/http/gateway";

const at = (path: string) => new URL(path, "https://app.plektia.workers.dev");

describe("cacheKeyFor: la clave sin parámetros de seguimiento", () => {
  it("una visita desde la bio de Instagram cae en la misma entrada que la URL limpia", () => {
    expect(
      cacheKeyFor(
        "GET",
        at("/juedsay?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAZXh0bgNhZW0"),
      ),
    ).toBe("/juedsay");
  });

  it("conserva los demás parámetros, en su orden", () => {
    expect(cacheKeyFor("GET", at("/plektia?e2e=ab12&gclid=x&otro=1"))).toBe(
      "/plektia?e2e=ab12&otro=1",
    );
  });

  it("no distingue mayúsculas en el nombre del parámetro", () => {
    expect(cacheKeyFor("GET", at("/juedsay?UTM_Source=x&FBCLID=y"))).toBe("/juedsay");
  });

  it("sin nada que sacar, vale la clave de siempre", () => {
    expect(cacheKeyFor("GET", at("/juedsay"))).toBeNull();
    expect(cacheKeyFor("GET", at("/plektia?e2e=ab12"))).toBeNull();
  });

  it("HEAD comparte la entrada con GET", () => {
    expect(cacheKeyFor("HEAD", at("/juedsay?fbclid=x"))).toBe("/juedsay");
  });

  it("lo que no se cachea no lleva clave", () => {
    expect(cacheKeyFor("POST", at("/_actions/links.create?utm_source=x"))).toBeNull();
  });
});

describe("forwardedRequest: el país viaja en un encabezado propio", () => {
  it("pone el país de Cloudflare", () => {
    const forwarded = forwardedRequest(new Request(at("/api/e")), "AR");
    expect(forwarded.headers.get(COUNTRY_HEADER)).toBe("AR");
  });

  it("descarta el que mande el visitante, aunque Cloudflare no tenga país", () => {
    const spoofed = new Request(at("/api/e"), { headers: { [COUNTRY_HEADER]: "US" } });
    expect(forwardedRequest(spoofed, undefined).headers.has(COUNTRY_HEADER)).toBe(false);
    expect(forwardedRequest(spoofed, "BR").headers.get(COUNTRY_HEADER)).toBe("BR");
  });

  it("ignora un país que no son dos letras", () => {
    expect(forwardedRequest(new Request(at("/")), "T1").headers.has(COUNTRY_HEADER)).toBe(false);
  });

  it("conserva el método, la URL, los encabezados y el cuerpo", async () => {
    const original = new Request(at("/api/e?x=1"), {
      method: "POST",
      headers: { "content-type": "text/plain", "cf-connecting-ip": "203.0.113.7" },
      body: '{"type":"view"}',
    });
    const forwarded = forwardedRequest(original, "AR");
    expect(forwarded.method).toBe("POST");
    expect(forwarded.url).toBe(original.url);
    expect(forwarded.headers.get("cf-connecting-ip")).toBe("203.0.113.7");
    expect(await forwarded.text()).toBe('{"type":"view"}');
  });
});
