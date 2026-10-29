import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPage } from "@/application/pages/create-page";
import { listPages } from "@/application/pages/list-pages";
import { selectPage } from "@/application/pages/select-page";
import { PAGE_LIMIT, parsePageInput, type PageDraft } from "@/domain/page";
import type { Database } from "@/infrastructure/supabase/database.types";
import { SupabasePageRepository } from "@/infrastructure/supabase/supabase-page-repository";

import { RecordingPageCache } from "../unit/application/fakes/recording-page-cache";
import { clientFor } from "./session-client";

// El owner del seed tiene dos páginas: /juedsay (con su mismo id) y /demo-segunda.
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_SECOND_PAGE_ID = "9a9e0000-0000-4000-8000-000000000002";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

let ownerClient: SupabaseClient<Database>;
let repo: SupabasePageRepository;

function draftFor(handle: string): PageDraft {
  const draft = parsePageInput({ handle, displayName: handle });
  if (!draft.ok) throw new Error("draft inválido");
  return draft.value;
}

/** Deja al owner como en el seed: sus dos páginas y sin última página elegida. */
async function restoreOwner(): Promise<void> {
  await ownerClient
    .from("pages")
    .delete()
    .eq("owner_id", OWNER_ID)
    .not("id", "in", `(${OWNER_ID},${OWNER_SECOND_PAGE_ID})`);
  await ownerClient.from("profiles").update({ last_page_id: null }).eq("id", OWNER_ID);
}

describe("SupabasePageRepository contra Supabase local", () => {
  beforeAll(async () => {
    ownerClient = await clientFor("owner@plektia.test");
    repo = new SupabasePageRepository(ownerClient, OWNER_ID);
    await restoreOwner();
  });

  afterEach(restoreOwner);

  it("lista solo las páginas propias, de la más vieja a la más nueva", async () => {
    const pages = await repo.listOwn();
    expect(pages.map((page) => page.handle)).toEqual(["juedsay", "demo-segunda"]);
    expect(pages.some((page) => page.id === MEMBER_ID)).toBe(false);
  });

  it(`altas simultáneas: nunca pasan de ${String(PAGE_LIMIT)} páginas`, async () => {
    const results = await Promise.all(
      ["juedsay-uno", "juedsay-dos", "juedsay-tres", "juedsay-cuatro"].map((handle) =>
        repo.createPage(draftFor(handle)),
      ),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual(
      Array.from({ length: 3 }, () => ({ ok: false, error: "limit_reached" })),
    );
    expect(await repo.listOwn()).toHaveLength(PAGE_LIMIT);
  });

  it("doble envío simultáneo del alta (mismo id): una sola página y los dos ven la misma", async () => {
    const input = {
      id: "c0ffee00-0000-4000-8000-000000000003",
      handle: "juedsay-una-vez",
      displayName: "Una vez",
    };
    const create = createPage({ pages: repo, cache: new RecordingPageCache() });
    // El owner tiene 2: la nueva completa el límite, y el otro envío choca con él.
    const [first, second] = await Promise.all([create(input), create(input)]);
    expect(first).toMatchObject({ ok: true, value: { id: input.id } });
    expect(second).toEqual(first);
    expect((await repo.listOwn()).filter((page) => page.handle === input.handle)).toHaveLength(1);
  });

  it("un handle usado por otra página da handle_taken", async () => {
    expect(await repo.createPage(draftFor("miembro-demo"))).toEqual({
      ok: false,
      error: "handle_taken",
    });
  });

  it("recuerda la última página usada y el panel abre esa", async () => {
    expect((await listPages({ pages: repo })()).currentPageId).toBe(OWNER_ID);
    expect(await selectPage({ pages: repo })({ pageId: OWNER_SECOND_PAGE_ID })).toEqual({
      ok: true,
      value: undefined,
    });
    expect((await listPages({ pages: repo })()).currentPageId).toBe(OWNER_SECOND_PAGE_ID);
  });

  it("no puede elegir como última una página de otra cuenta", async () => {
    expect(await repo.rememberLastPage(MEMBER_ID)).toEqual({ ok: false, error: "not_found" });
    expect(await repo.lastUsedPageId()).toBeNull();
  });

  it("cambia la presentación de una página propia, no la de otra cuenta", async () => {
    const settings = {
      displayName: "Otro nombre",
      bio: null,
      theme: "tecnico",
      colorMode: "auto",
      accent: "hueso",
      linkShape: "rows",
      showHandle: false,
    } as const;
    try {
      expect(await repo.updatePageSettings(OWNER_SECOND_PAGE_ID, settings)).toMatchObject({
        ok: true,
        value: { handle: "demo-segunda", displayName: "Otro nombre", bio: null, showHandle: false },
      });
      expect(await repo.updatePageSettings(MEMBER_ID, settings)).toEqual({
        ok: false,
        error: "not_found",
      });
    } finally {
      await ownerClient
        .from("pages")
        .update({
          display_name: "Página de prueba",
          bio: "Segunda página de la misma cuenta",
          show_handle: true,
        })
        .eq("id", OWNER_SECOND_PAGE_ID);
    }
  });
});
