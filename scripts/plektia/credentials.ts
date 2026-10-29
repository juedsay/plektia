// Credenciales del CLI (tarea 32c): las de la app registrada y los tokens de
// OAuth, guardados solo en la carpeta de configuración del usuario, con
// permisos restringidos. Una entrada por servidor (producción o local).
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

/** Puerto fijo: Supabase registra la URL de vuelta exacta de cada app. */
export const CALLBACK_PORT = 8976;
export const REDIRECT_URL = `http://127.0.0.1:${String(CALLBACK_PORT)}/callback`;

interface ServerCredentials {
  client?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  codeVerifier?: string;
}

type Store = Record<string, ServerCredentials>;

/** `%APPDATA%\plektia` en Windows; `$XDG_CONFIG_HOME/plektia` o `~/.config/plektia` en el resto. */
export function configDirectory(env: NodeJS.ProcessEnv = process.env): string {
  if (process.platform === "win32" && env["APPDATA"]) return join(env["APPDATA"], "plektia");
  return join(env["XDG_CONFIG_HOME"] ?? join(homedir(), ".config"), "plektia");
}

export class CredentialsFile {
  readonly path: string;

  constructor(directory: string = configDirectory()) {
    this.path = join(directory, "credentials.json");
  }

  read(server: string): ServerCredentials {
    return this.all()[server] ?? {};
  }

  update(server: string, change: (current: ServerCredentials) => ServerCredentials): void {
    const store = this.all();
    store[server] = change(store[server] ?? {});
    const directory = join(this.path, "..");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(this.path, JSON.stringify(store, null, 2), { mode: 0o600 });
    // Si ya existía con otros permisos, se ajustan (en Windows no tiene efecto:
    // la carpeta del perfil ya es solo del usuario).
    chmodSync(this.path, 0o600);
  }

  /** Olvida el servidor; si no queda ninguno, borra el archivo. */
  forget(server: string): boolean {
    const store = this.all();
    if (!(server in store)) return false;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- la clave es la URL del servidor.
    delete store[server];
    if (Object.keys(store).length === 0) rmSync(this.path, { force: true });
    else writeFileSync(this.path, JSON.stringify(store, null, 2), { mode: 0o600 });
    return true;
  }

  private all(): Store {
    if (!existsSync(this.path)) return {};
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path, "utf8"));
      return typeof parsed === "object" && parsed !== null ? (parsed as Store) : {};
    } catch {
      // Un archivo roto equivale a no tener sesión: el login lo reescribe.
      return {};
    }
  }
}

/**
 * El proveedor OAuth que pide el SDK: registro dinámico, PKCE y renovación los
 * hace el SDK; acá solo se guarda y se abre el navegador.
 */
export class FileOAuthProvider implements OAuthClientProvider {
  private expectedState: string | null = null;
  // Campos explícitos: Node corre este archivo quitando solo los tipos, y no
  // admite propiedades declaradas en los parámetros del constructor.
  private readonly server: string;
  private readonly credentials: CredentialsFile;
  private readonly openBrowser: (url: URL) => void;

  constructor(server: string, credentials: CredentialsFile, openBrowser: (url: URL) => void) {
    this.server = server;
    this.credentials = credentials;
    this.openBrowser = openBrowser;
  }

  get redirectUrl(): string {
    return REDIRECT_URL;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "Plektia CLI",
      redirect_uris: [REDIRECT_URL],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }

  state(): string {
    this.expectedState = crypto.randomUUID();
    return this.expectedState;
  }

  /** El `state` que tiene que volver en la URL de vuelta (protección contra CSRF). */
  get pendingState(): string | null {
    return this.expectedState;
  }

  clientInformation(): OAuthClientInformationMixed | undefined {
    return this.credentials.read(this.server).client;
  }

  saveClientInformation(client: OAuthClientInformationMixed): void {
    this.credentials.update(this.server, (current) => ({ ...current, client }));
  }

  tokens(): OAuthTokens | undefined {
    return this.credentials.read(this.server).tokens;
  }

  saveTokens(tokens: OAuthTokens): void {
    this.credentials.update(this.server, (current) => ({ ...current, tokens }));
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    const local =
      authorizationUrl.hostname === "127.0.0.1" || authorizationUrl.hostname === "localhost";
    if (authorizationUrl.protocol !== "https:" && !local) {
      throw new Error(`La autorización no va por https: ${authorizationUrl.origin}`);
    }
    this.openBrowser(authorizationUrl);
  }

  saveCodeVerifier(codeVerifier: string): void {
    this.credentials.update(this.server, (current) => ({ ...current, codeVerifier }));
  }

  codeVerifier(): string {
    const verifier = this.credentials.read(this.server).codeVerifier;
    if (!verifier) throw new Error("No hay un login en curso: corré `pnpm plektia login`.");
    return verifier;
  }

  invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery"): void {
    const dropped: Record<typeof scope, readonly (keyof ServerCredentials)[]> = {
      all: ["client", "tokens", "codeVerifier"],
      client: ["client", "tokens"],
      tokens: ["tokens"],
      verifier: ["codeVerifier"],
      discovery: [],
    };
    this.credentials.update(this.server, (current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) => !dropped[scope].includes(key as keyof ServerCredentials),
        ),
      ),
    );
  }
}
