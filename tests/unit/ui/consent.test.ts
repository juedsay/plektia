import { describe, expect, it } from "vitest";

import { consentHost } from "@/ui/view/consent";
import { protectedResourceMetadata, wwwAuthenticate } from "@/infrastructure/mcp/resource-metadata";

describe("destino en el consentimiento", () => {
  it("muestra el host; avisa si es local o va sin conexión segura", () => {
    expect(consentHost("https://claude.ai/api/mcp/auth_callback")).toEqual({
      label: "claude.ai",
      local: false,
      insecure: false,
    });
    expect(consentHost("http://127.0.0.1:53682/callback")).toEqual({
      label: "127.0.0.1:53682",
      local: true,
      insecure: false,
    });
    expect(consentHost("http://app.example/cb")).toMatchObject({ insecure: true });
    expect(consentHost("cursor://anysphere.cursor-retrieval/oauth")).toEqual({
      label: "cursor",
      local: true,
      insecure: false,
    });
    expect(consentHost("no es una url")).toBeNull();
  });
});

describe("metadatos del recurso protegido", () => {
  it("apuntan a /mcp y al Auth del proyecto", () => {
    expect(protectedResourceMetadata("https://plektia.app", "https://x.supabase.co/")).toEqual({
      resource: "https://plektia.app/mcp",
      authorization_servers: ["https://x.supabase.co/auth/v1"],
      bearer_methods_supported: ["header"],
      resource_name: "Plektia",
    });
    expect(wwwAuthenticate("https://plektia.app")).toBe(
      'Bearer resource_metadata="https://plektia.app/.well-known/oauth-protected-resource"',
    );
  });
});
