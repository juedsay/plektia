import { describe, expect, it } from "vitest";

import { OAUTH_PROVIDERS } from "@/application/ports/auth-gateway";

describe("OAUTH_PROVIDERS", () => {
  // SPEC-identity: solo GitHub y Google. El hook de la base también rechaza
  // cualquier otro proveedor; sumar uno exige cambiar los dos lados.
  it("solo permite GitHub y Google", () => {
    expect(OAUTH_PROVIDERS).toEqual(["github", "google"]);
  });
});
