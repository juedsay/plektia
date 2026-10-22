// Cabeceras de seguridad comunes a todas las respuestas (SPEC-platform).
//
// La CSP de scripts y estilos (con hashes) la genera Astro con `security.csp`.
// Esta CSP complementa con directivas que solo funcionan como cabecera HTTP
// (`frame-ancestors` se ignora en un <meta>); el navegador aplica ambas.

const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "camera=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  "usb=()",
  "interest-cohort=()",
].join(", ");

const BASE_CSP = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export function securityHeaders(): Readonly<Record<string, string>> {
  return {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": PERMISSIONS_POLICY,
    // Respaldo para navegadores viejos que no entienden `frame-ancestors`.
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": BASE_CSP,
  };
}

const directiveName = (directive: string): string => directive.trim().split(/\s+/)[0] ?? "";

// Combina dos CSP por directiva: conserva todas las de `current` (la que generó
// Astro o definió la ruta) y suma de `base` solo las que faltan.
function mergeCsp(current: string, base: string): string {
  const directives = current
    .split(";")
    .map((directive) => directive.trim())
    .filter(Boolean);
  const present = new Set(directives.map(directiveName));

  for (const directive of base.split(";").map((directive) => directive.trim())) {
    if (directive && !present.has(directiveName(directive))) directives.push(directive);
  }

  return directives.join("; ");
}

// Agrega las cabeceras sin pisar las que la ruta ya definió: una ruta puede
// necesitar una política propia (por ejemplo, la vista previa del panel en un iframe).
// La CSP se combina por directiva para no perder `frame-ancestors` cuando Astro
// ya emitió la suya como cabecera.
export function applySecurityHeaders(headers: Headers): void {
  for (const [name, value] of Object.entries(securityHeaders())) {
    const current = headers.get(name);
    if (current === null) {
      headers.set(name, value);
    } else if (name === "Content-Security-Policy") {
      headers.set(name, mergeCsp(current, value));
    }
  }
}
