import { describe, expect, it } from "vitest";

import { MAX_URL_LENGTH, parseSafeUrl } from "@/domain/safe-url";

describe("parseSafeUrl", () => {
  it.each([
    ["https://plektia.app", "https://plektia.app/"],
    ["https://www.youtube.com/@juedsay", "https://www.youtube.com/@juedsay"],
    [
      "https://github.com/juedsay?tab=repositories#top",
      "https://github.com/juedsay?tab=repositories#top",
    ],
    ["https://wa.me/5491112345678", "https://wa.me/5491112345678"],
    ["mailto:hola@plektia.app", "mailto:hola@plektia.app"],
    ["mailto:hola@plektia.app?subject=Hola", "mailto:hola@plektia.app?subject=Hola"],
    // Normalización: mayúsculas del esquema y del host, espacios al borde, puerto por defecto.
    ["HTTPS://GitHub.COM/juedsay", "https://github.com/juedsay"],
    ["  https://plektia.app/a  ", "https://plektia.app/a"],
    ["https://plektia.app:443/a", "https://plektia.app/a"],
    // Dominios internacionales: se guardan en punycode (el panel los muestra así).
    ["https://ñandú.com.ar/", "https://xn--and-6ma2c.com.ar/"],
    ["https://pаypal.com/", "https://xn--pypal-4ve.com/"],
  ])("acepta %j como %j", (input, expected) => {
    expect(parseSafeUrl(input)).toEqual({ ok: true, value: expected });
  });

  // XSS, phishing y URLs rotas: todas quedan afuera.
  it.each([
    ["esquema javascript", "javascript:alert(1)"],
    ["javascript en mayúsculas", "JAVASCRIPT:alert(1)"],
    ["javascript con espacio inicial", " javascript:alert(1)"],
    ["javascript con tab en el medio", "java\tscript:alert(1)"],
    ["javascript con salto de línea", "java\nscript:alert(1)"],
    ["javascript con retorno de carro", "java\rscript:alert(1)"],
    ["javascript con carácter nulo", "java\u0000script:alert(1)"],
    ["javascript con entidad HTML", "javascript&colon;alert(1)"],
    ["esquema data", "data:text/html,<script>alert(1)</script>"],
    ["esquema data en base64", "data:text/html;base64,PHNjcmlwdD4="],
    ["esquema vbscript", "vbscript:msgbox(1)"],
    ["esquema file", "file:///etc/passwd"],
    ["http sin cifrar", "http://plektia.app"],
    ["ftp", "ftp://plektia.app"],
    ["blob", "blob:https://plektia.app/uuid"],
    ["credenciales embebidas", "https://user:pass@plektia.app"],
    ["usuario embebido", "https://google.com@evil.com"],
    ["usuario vacío embebido", "https://:@evil.com"],
    ["sin esquema", "plektia.app"],
    ["relativa", "/admin"],
    ["protocolo relativo", "//evil.com"],
    ["texto vacío", ""],
    ["solo espacios", "   "],
    ["mailto sin dirección", "mailto:"],
    ["https sin host", "https://"],
    ["control en el medio de una URL válida", "https://plektia.app/a\u0007b"],
    ["demasiado larga", `https://plektia.app/${"a".repeat(MAX_URL_LENGTH)}`],
  ])("rechaza %s", (_caso, input) => {
    expect(parseSafeUrl(input)).toEqual({ ok: false, error: "invalid_url" });
  });

  it.each([null, undefined, 42, {}, ["https://plektia.app"]])(
    "rechaza valores que no son texto (%j)",
    (input) => {
      expect(parseSafeUrl(input)).toEqual({ ok: false, error: "invalid_url" });
    },
  );
});
