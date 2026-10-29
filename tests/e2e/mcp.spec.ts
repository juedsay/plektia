import { randomBytes } from "node:crypto";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { expect, test } from "@playwright/test";

import { connectMcpClient } from "./support/session";

// `/mcp` por HTTP (tarea 31, SPEC-mcp-server): sin token, 401 con dónde
// autenticarse; con un token real, el cliente del SDK lista y usa las
// herramientas; revocar la conexión corta el acceso en la llamada siguiente.
test.use({
  extraHTTPHeaders: { "cf-connecting-ip": `2001:db8:0c::${randomBytes(2).toString("hex")}` },
});

async function mcpClient(baseURL: string, accessToken: string) {
  const client = new Client({ name: "e2e", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL("/mcp", baseURL), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  // El SDK 1.32.1 no declara `| undefined` en las propiedades opcionales del
  // transporte (lo corrige 1.32.2); con `exactOptionalPropertyTypes` hace falta el cast.
  await client.connect(transport as unknown as Transport);
  return client;
}

test("sin token: 401 con los metadatos para autenticarse", async ({ request, baseURL }) => {
  const response = await request.post("/mcp", {
    data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    headers: { Accept: "application/json, text/event-stream" },
  });
  expect(response.status()).toBe(401);
  expect(response.headers()["www-authenticate"]).toBe(
    `Bearer resource_metadata="${baseURL ?? ""}/.well-known/oauth-protected-resource"`,
  );
  expect(response.headers()["cache-control"]).toContain("no-store");

  const forged = await request.post("/mcp", {
    data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    headers: { Authorization: "Bearer cabecera.carga.firma" },
  });
  expect(forged.status()).toBe(401);

  // CORS en la respuesta real (el preflight OPTIONS lo contesta el servidor de
  // vista previa local antes de llegar al Worker: lo cubre el test unitario).
  expect(response.headers()["access-control-allow-origin"]).toBe("*");
  expect(response.headers()["access-control-expose-headers"]).toContain("WWW-Authenticate");
  expect((await request.get("/mcp")).status()).toBe(405);
});

test("con un token de solo lectura: lee la página y no puede escribir", async ({ baseURL }) => {
  const { accessToken } = await connectMcpClient("avatar@plektia.test", false);
  const client = await mcpClient(baseURL ?? "", accessToken);
  const { tools } = await client.listTools();
  expect(tools.map((tool) => tool.name)).toContain("get_page");

  const page = await client.callTool({ name: "get_page", arguments: {} });
  expect(page.isError).toBeFalsy();
  expect(JSON.stringify(page.content)).toContain("avatar-demo");

  const created = await client.callTool({
    name: "create_link",
    arguments: { title: "No", url: "https://ejemplo.com" },
  });
  expect(created.isError).toBe(true);
  await client.close();
});

test("revocar la conexión corta el acceso en la llamada siguiente", async ({ request }) => {
  const { accessToken, revoke } = await connectMcpClient("avatar@plektia.test", true);
  const call = () =>
    request.post("/mcp", {
      data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json, text/event-stream",
      },
    });
  expect((await call()).status()).toBe(200);
  await revoke();
  expect((await call()).status()).toBe(401);
});
