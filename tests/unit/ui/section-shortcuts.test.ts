// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";

import { connectSectionShortcuts } from "@/ui/scripts/section-shortcuts";

beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
});

function setup() {
  document.body.innerHTML = `
    <header class="admin-bar">Plektia</header>
    <nav data-section-shortcuts>
      <a href="#perfil">Perfil</a><a href="#estilo">Estilo</a><a href="#forma">Forma</a>
    </nav>
    <section id="perfil"></section><fieldset id="estilo"></fieldset><fieldset id="forma"></fieldset>`;
  const nav = document.querySelector<HTMLElement>("[data-section-shortcuts]");
  if (!nav) throw new Error("faltan los atajos");
  connectSectionShortcuts(nav);
  const link = (name: string) => {
    const found = [...nav.querySelectorAll("a")].find((anchor) => anchor.textContent === name);
    if (!found) throw new Error(`falta ${name}`);
    return found;
  };
  return { link };
}

describe("connectSectionShortcuts", () => {
  it("al entrar, marca una sola parte", () => {
    setup();
    expect(document.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  });

  it("al tocar un atajo, queda marcado ese y solo ese", () => {
    const { link } = setup();
    link("Forma").click();
    expect(link("Forma").getAttribute("aria-current")).toBe("true");
    expect(link("Perfil").hasAttribute("aria-current")).toBe(false);
    expect(link("Estilo").hasAttribute("aria-current")).toBe(false);
  });

  it("publica la altura de la barra de arriba para los atajos fijos", () => {
    setup();
    expect(document.documentElement.style.getPropertyValue("--admin-bar-height")).toMatch(/px$/);
  });
});
