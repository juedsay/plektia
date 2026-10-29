// Cómo se muestra el destino de una app en el consentimiento: el host, si es un
// programa local (el CLI, con `127.0.0.1`) y si va sin conexión segura.

export interface ConsentHost {
  readonly label: string;
  readonly local: boolean;
  readonly insecure: boolean;
}

const LOOPBACK = new Set(["127.0.0.1", "[::1]", "localhost"]);

export function consentHost(uri: string): ConsentHost | null {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return null;
  }
  const local = LOOPBACK.has(url.hostname);
  if (url.protocol === "https:" || url.protocol === "http:") {
    return { label: url.host, local, insecure: url.protocol === "http:" && !local };
  }
  // Esquemas propios de apps de escritorio (`cursor://…`): se muestra el esquema.
  return { label: url.protocol.replace(/:$/, ""), local: true, insecure: false };
}
