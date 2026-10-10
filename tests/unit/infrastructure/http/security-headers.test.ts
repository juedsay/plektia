import { describe, expect, it } from "vitest";

import { applySecurityHeaders, securityHeaders } from "@/infrastructure/http/security-headers";

describe("securityHeaders", () => {
  const headers = securityHeaders();

  it("fuerza HTTPS por dos años en el dominio y sus subdominios", () => {
    expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains");
  });

  it("impide que el navegador adivine tipos de contenido", () => {
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("solo envía el origen al salir hacia otros sitios", () => {
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("niega cámara, micrófono, ubicación y otras APIs sensibles", () => {
    const policy = headers["Permissions-Policy"];

    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it("no permite que otros sitios embeban las páginas (clickjacking)", () => {
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  });

  it("bloquea plugins, cambios de <base> y envíos de formularios a otros orígenes", () => {
    const csp = headers["Content-Security-Policy"];

    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("aísla la ventana y los recursos de otros orígenes", () => {
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(headers["Cross-Origin-Resource-Policy"]).toBe("same-origin");
  });
});

describe("applySecurityHeaders", () => {
  it("agrega las cabeceras sin borrar las que ya trae la respuesta", () => {
    const response = new Response("hola", { headers: { "Content-Type": "text/html" } });

    applySecurityHeaders(response.headers);

    expect(response.headers.get("Content-Type")).toBe("text/html");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("suma las directivas base que le faltan a la CSP que genera Astro", () => {
    const response = new Response("hola", {
      headers: { "Content-Security-Policy": "default-src 'self'; script-src 'self' 'sha256-abc='" },
    });

    applySecurityHeaders(response.headers);

    const csp = response.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'sha256-abc='");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("no pisa una directiva que la ruta definió a propósito", () => {
    const response = new Response("hola", {
      headers: { "Content-Security-Policy": "frame-ancestors 'self'" },
    });

    applySecurityHeaders(response.headers);

    const csp = response.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).not.toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("no duplica directivas aunque se aplique dos veces", () => {
    const response = new Response("hola");

    applySecurityHeaders(response.headers);
    applySecurityHeaders(response.headers);

    const csp = response.headers.get("Content-Security-Policy") ?? "";
    expect(csp.match(/frame-ancestors/g)).toHaveLength(1);
  });
});
