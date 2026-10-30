import { describe, expect, it } from "vitest";

import { toSafeLine } from "@/domain/text";
import { decodeEntities, parsePreviewMeta } from "@/infrastructure/http/preview-meta";

const PAGE = new URL("https://ejemplo.com/blog/nota");

describe("parsePreviewMeta", () => {
  it("toma og:title, og:description y og:image (con comillas simples, dobles o sin comillas)", () => {
    const html = `<html><head>
      <meta content="Mi nota" property="og:title">
      <meta property='og:description' content='Cómo testeo RLS'>
      <meta property=og:image content=/img/portada.png>
    </head><body></body></html>`;
    expect(parsePreviewMeta(html, PAGE)).toEqual({
      title: "Mi nota",
      description: "Cómo testeo RLS",
      imageUrl: "https://ejemplo.com/img/portada.png",
    });
  });

  it("sin og:*, usa twitter:*, description y <title>", () => {
    const html = `<head><title>Título &amp; algo</title>
      <meta name="description" content="Resumen"></head>`;
    expect(parsePreviewMeta(html, PAGE)).toMatchObject({
      title: "Título & algo",
      description: "Resumen",
      imageUrl: null,
    });
  });

  it("no se deja engañar por un <meta> en un comentario, un script o el body", () => {
    const html = `<head>
      <!-- <meta property="og:title" content="Falso"> -->
      <script>document.write('<meta property="og:title" content="Inyectado">')</script>
      <meta property="og:title" content="El de verdad">
    </head><body><meta property="og:description" content="Del body"></body>`;
    expect(parsePreviewMeta(html, PAGE)).toMatchObject({
      title: "El de verdad",
      description: null,
    });
  });

  it("una imagen que no es https se descarta", () => {
    const html = `<head><meta property="og:title" content="x">
      <meta property="og:image" content="http://ejemplo.com/a.png"></head>`;
    expect(parsePreviewMeta(html, PAGE).imageUrl).toBeNull();
    const javascript = `<head><meta property="og:image" content="javascript:alert(1)"></head>`;
    expect(parsePreviewMeta(javascript, PAGE).imageUrl).toBeNull();
  });

  it("el texto sale como una línea segura y cortada", () => {
    const long = "palabra ".repeat(40);
    const html = `<head><meta property="og:title" content="Línea‮oculta
      con salto"><meta property="og:description" content="${long}"></head>`;
    const meta = parsePreviewMeta(html, PAGE);
    expect(meta.title).toBe("Línea oculta con salto");
    expect(meta.description?.endsWith("…")).toBe(true);
    expect(Array.from(meta.description ?? "")).toHaveLength(120);
  });
});

describe("decodeEntities", () => {
  it("decodifica nombres comunes y números, y descarta los inválidos", () => {
    expect(decodeEntities("a &lt;b&gt; &quot;c&quot; &#39;d&#39; &#x41; &hellip;")).toBe(
      "a <b> \"c\" 'd' A …",
    );
    expect(decodeEntities("&#xD800;&#0;")).toBe("");
    expect(decodeEntities("&desconocida;")).toBe("&desconocida;");
  });
});

describe("toSafeLine", () => {
  it("junta espacios, saca invisibles y corta con …", () => {
    expect(toSafeLine("  hola​   mundo\n", 80)).toBe("hola mundo");
    expect(toSafeLine("abcdef", 4)).toBe("abc…");
    expect(toSafeLine(" ​ ", 80)).toBeNull();
  });
});
