import { randomUUID } from "node:crypto";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, inject, it } from "vitest";

import { createMcpWorkspace } from "@/composition/mcp";
import { err } from "@/domain/result";
import { createMcpServer } from "@/infrastructure/mcp/server";
import { SupabaseMcpTokenVerifier } from "@/infrastructure/mcp/token-verifier";
import type { Database } from "@/infrastructure/supabase/database.types";
import { McpRpcLinkWriter } from "@/infrastructure/supabase/mcp-rpc-writers";

import { connect, sessionFor } from "./oauth-connection";

// El servidor MCP contra Supabase local (tarea 31): un token real de un
// cliente conectado, las herramientas y las funciones `mcp_*` de verdad.
const supabase = inject("supabase");
const config = { url: supabase.url, publishableKey: supabase.publishableKey };
const verifier = new SupabaseMcpTokenVerifier(config);

async function mcpClientFor(accessToken: string): Promise<Client> {
  const caller = await verifier.verify(accessToken);
  if (!caller) throw new Error("token rechazado");
  const workspace = createMcpWorkspace(config, caller, {
    origin: "https://plektia.test",
    cache: { purgeProfile: () => Promise.resolve(), purgeSite: () => Promise.resolve() },
    checkLive: () => Promise.resolve(err("unavailable")),
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createMcpServer(workspace).connect(serverSide);
  const client = new Client({ name: "integracion", version: "1.0.0" });
  await client.connect(clientSide);
  return client;
}

const textOf = (result: unknown) =>
  (result as CallToolResult).content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");

describe("servidor MCP contra Supabase", () => {
  let owner: SupabaseClient<Database>;
  let pageId: string;

  beforeAll(async () => {
    // Un usuario que no usa ninguna otra prueba de integración: estas crean
    // links en su página y las del repositorio exigen órdenes completos.
    owner = await sessionFor("avatar@plektia.test");
    const { data } = await owner.auth.getUser();
    const pages = await owner
      .from("pages")
      .select("id")
      .eq("owner_id", data.user?.id ?? "");
    pageId = pages.data?.[0]?.id ?? "";
  });

  it("solo lectura: ve su página, no escribe ni por la herramienta ni por la base", async () => {
    const { accessToken } = await connect(owner, false);
    const client = await mcpClientFor(accessToken);
    const page = await client.callTool({ name: "get_page", arguments: {} });
    expect(page.isError).toBeFalsy();
    expect(textOf(page)).toContain('"canWrite": false');

    const created = await client.callTool({
      name: "create_link",
      arguments: { title: "No debería", url: "https://ejemplo.com" },
    });
    expect(created.isError).toBe(true);

    // Aunque alguien se saltee la herramienta, la base lo frena.
    const direct = writerWithToken(accessToken, pageId);
    const forced = await direct.createLink({
      title: "Forzado",
      url: "https://ejemplo.com",
      description: null,
      tags: [],
      sectionId: null,
      visible: true,
      provider: "generic",
      providerHandle: null,
      kind: null,
    });
    expect(forced).toEqual(err("forbidden"));
  });

  it("edición: crea (sin duplicar), edita y borra con el título exacto", async () => {
    const { accessToken } = await connect(owner, true);
    const client = await mcpClientFor(accessToken);
    const requestId = randomUUID();
    const title = `MCP ${requestId.slice(0, 8)}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      const created = await client.callTool({
        name: "create_link",
        arguments: { title, url: "https://ejemplo.com/mcp", requestId },
      });
      expect(created.isError).toBeFalsy();
    }
    const rows = await owner.from("links").select("id, version, title").eq("id", requestId);
    expect(rows.data).toHaveLength(1);

    const updated = await client.callTool({
      name: "update_link",
      arguments: { id: requestId, version: 1, title: `${title} editado` },
    });
    expect(updated.isError).toBeFalsy();

    const wrong = await client.callTool({
      name: "delete_link",
      arguments: { id: requestId, version: 2, confirm_title: title },
    });
    expect(wrong.isError).toBe(true);
    expect(textOf(wrong)).toContain("no coincide");

    const deleted = await client.callTool({
      name: "delete_link",
      arguments: { id: requestId, version: 2, confirm_title: `${title} editado` },
    });
    expect(deleted.isError).toBeFalsy();
    const gone = await owner.from("links").select("id").eq("id", requestId);
    expect(gone.data).toEqual([]);
  });
});

/** Lo que haría alguien que se saltea la herramienta: la función `mcp_*` directo. */
function writerWithToken(accessToken: string, pageId: string) {
  const client = createClient<Database>(supabase.url, supabase.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  return new McpRpcLinkWriter(client, pageId);
}
