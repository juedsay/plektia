// CLI de Plektia (tarea 32c): un cliente fino del mismo `/mcp` que usa Claude.
// Mismo login (OAuth con PKCE, en el navegador), mismos permisos, auditoría y
// revocación: aparece en /admin/conexiones como "Plektia CLI".
//
//   pnpm plektia ayuda
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { createInterface } from "node:readline/promises";

import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { findItem, HELP, parseCommand, payloadOf, type Command } from "./commands.ts";
import { CALLBACK_PORT, CredentialsFile, FileOAuthProvider } from "./credentials.ts";

const SERVER = (process.env["PLEKTIA_URL"] ?? "https://app.plektia.workers.dev").replace(/\/$/, "");
const MCP_URL = new URL("/mcp", SERVER);
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

function openBrowser(url: URL): void {
  const target = url.href;
  console.info(`Abrí este link si el navegador no se abre solo:\n  ${target}\n`);
  // Sin shell: la URL va como argumento, nunca interpretada.
  if (process.platform === "win32")
    execFile("rundll32.exe", ["url.dll,FileProtocolHandler", target]);
  else if (process.platform === "darwin") execFile("open", [target]);
  else execFile("xdg-open", [target]);
}

const credentials = new CredentialsFile();
const provider = new FileOAuthProvider(SERVER, credentials, openBrowser);

function transport(): Transport {
  // El SDK 1.32.1 no declara `| undefined` en las propiedades opcionales del
  // transporte (lo corrige 1.32.2); con `exactOptionalPropertyTypes` hace falta el cast.
  return new StreamableHTTPClientTransport(MCP_URL, {
    authProvider: provider,
  }) as unknown as Transport;
}

/** Espera la vuelta del navegador en 127.0.0.1 con el código (y el `state` esperado). */
function waitForCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", `http://127.0.0.1:${String(CALLBACK_PORT)}`);
      if (url.pathname !== "/callback") {
        response.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get("code");
      const failed = url.searchParams.get("error");
      const stateMatches = url.searchParams.get("state") === provider.pendingState;
      response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      if (code && stateMatches) {
        response.end("Listo: ya podés volver a la terminal.");
        resolve(code);
      } else {
        response.end("No se completó la conexión. Volvé a la terminal.");
        reject(
          new Error(
            failed === "access_denied" ? "Rechazaste el acceso." : "La vuelta no es válida.",
          ),
        );
      }
      server.close();
    });
    server.on("error", reject);
    server.listen(CALLBACK_PORT, "127.0.0.1");
    setTimeout(() => {
      server.close();
      reject(new Error("Se terminó el tiempo para autorizar (5 minutos)."));
    }, LOGIN_TIMEOUT_MS).unref();
  });
}

/** Conecta; si no hay acceso (o se revocó), hace el login en el navegador. */
async function connect(): Promise<Client> {
  const client = new Client({ name: "plektia-cli", version: "1.0.0" });
  const first = transport();
  try {
    await client.connect(first);
    return client;
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) throw error;
  }
  console.info("Hace falta autorizar esta compu en Plektia.");
  const code = await waitForCode();
  await (first as unknown as StreamableHTTPClientTransport).finishAuth(code);
  const again = new Client({ name: "plektia-cli", version: "1.0.0" });
  await again.connect(transport());
  return again;
}

function textOf(result: unknown): string {
  return (result as CallToolResult).content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n");
}

async function call(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(textOf(result));
  return textOf(result);
}

interface ShownLink {
  id: string;
  title: string;
  url: string;
  visible: boolean;
}

function printPage(payload: unknown): void {
  const shown = payload as {
    page: { handle: string; url: string; displayName: string };
    sections: { id: string; title: string; visible: boolean; links: ShownLink[] }[];
    unsectioned: ShownLink[];
    canWrite: boolean;
  };
  const hidden = (visible: boolean) => (visible ? "" : " (oculto)");
  const printLinks = (links: ShownLink[]) => {
    for (const link of links) {
      console.info(`    ${link.id}  ${link.title}${hidden(link.visible)}\n      ${link.url}`);
    }
  };
  console.info(`${shown.page.displayName} · ${shown.page.url}`);
  console.info(shown.canWrite ? "Permiso: lectura y edición\n" : "Permiso: solo lectura\n");
  if (shown.unsectioned.length > 0) {
    console.info("  Sin sección");
    printLinks(shown.unsectioned);
  }
  for (const section of shown.sections) {
    console.info(`  ${section.id}  [${section.title}]${hidden(section.visible)}`);
    printLinks(section.links);
  }
}

async function confirmTitle(expected: string): Promise<string> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await prompt.question(`Para borrar "${expected}", escribí el título exacto: `);
  } finally {
    prompt.close();
  }
}

async function run(command: Command): Promise<void> {
  switch (command.kind) {
    case "help":
      if (command.error) console.error(`${command.error}\n`);
      console.info(HELP);
      if (command.error) process.exitCode = 2;
      return;
    case "logout": {
      const forgot = credentials.forget(SERVER);
      console.info(
        forgot
          ? "Listo: esta compu ya no tiene acceso guardado. Para revocarlo del todo, " +
              'desconectá "Plektia CLI" en el panel (Conexiones).'
          : "No había un acceso guardado.",
      );
      return;
    }
    default:
      break;
  }

  const client = await connect();
  try {
    const page = "page" in command ? { page: command.page } : {};
    switch (command.kind) {
      case "login":
        console.info("Conectado. Revisá el permiso con `pnpm plektia ver`.");
        return;
      case "tools": {
        const { tools } = await client.listTools();
        for (const tool of tools) console.info(`${tool.name}: ${tool.title ?? ""}`);
        return;
      }
      case "show":
        printPage(payloadOf(await call(client, "get_page", page)));
        return;
      case "stats":
        console.info(
          JSON.stringify(
            payloadOf(await call(client, "get_stats", { ...page, days: command.days })),
            null,
            2,
          ),
        );
        return;
      case "add":
        console.info(
          await call(client, "create_link", {
            ...page,
            title: command.title,
            url: command.url,
            sectionId: command.sectionId ?? null,
            ...(command.description === undefined ? {} : { description: command.description }),
            // Un id por pedido: si la red falla y se reintenta, no se duplica.
            requestId: crypto.randomUUID(),
          }),
        );
        return;
      case "visibility":
      case "delete": {
        const item = findItem(payloadOf(await call(client, "get_page", page)), command.id);
        if (!item) throw new Error(`No hay un link ni una sección con el id ${command.id}.`);
        if (command.kind === "visibility") {
          console.info(
            await call(client, "set_visibility", {
              ...page,
              kind: item.kind,
              id: item.id,
              version: item.version,
              visible: command.visible,
            }),
          );
          return;
        }
        const typed = command.confirm ?? (await confirmTitle(item.title));
        if (typed !== item.title) throw new Error("El título no coincide: no se borró nada.");
        console.info(
          await call(client, item.kind === "link" ? "delete_link" : "delete_section", {
            ...page,
            id: item.id,
            version: item.version,
            confirm_title: typed,
          }),
        );
        return;
      }
    }
  } finally {
    await client.close();
  }
}

run(parseCommand(process.argv.slice(2))).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
