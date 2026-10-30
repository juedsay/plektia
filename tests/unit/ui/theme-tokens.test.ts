import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AVAILABLE_THEMES, THEME_RULES } from "@/domain/theme";

// Contrato de cada variante con hoja propia (SPEC-styles): sus dos modos
// redefinen el set completo, automático-en-claro repite claro, todo el texto
// cumple AAA contra su fondo y su superficie, y cada acento que la variante
// admite tiene su tono AAA en los dos modos (también bajo un destacado).

const VARIANTS = AVAILABLE_THEMES.filter((theme) => theme !== "tecnico");
const tokensCss = readFileSync(join(process.cwd(), "src/ui/styles/tokens.css"), "utf8");
const tint = Number(/--highlight-tint:\s*(\d+)%/.exec(tokensCss)?.[1]) / 100;

const fileOf = (theme: string) => join(process.cwd(), `src/ui/styles/themes/${theme}.css`);

function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`no está el bloque ${selector}`);
  return css.slice(start, css.indexOf("}", start));
}

function hexes(text: string, prefix: string): Record<string, string> {
  const declaration = new RegExp(String.raw`(${prefix}[\w-]+):\s*(#[0-9a-f]{6})`, "gi");
  return Object.fromEntries(
    [...text.matchAll(declaration)].map((match) => [
      match[1] ?? "",
      (match[2] ?? "").toLowerCase(),
    ]),
  );
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

function mix(top: string, bottom: string, amount: number): string {
  const channel = (hex: string, offset: number) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16);
  return `#${[1, 3, 5]
    .map((offset) =>
      Math.round(channel(top, offset) * amount + channel(bottom, offset) * (1 - amount))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

describe.each(VARIANTS)("estilo %s", (theme) => {
  it("tiene su hoja propia", () => {
    expect(existsSync(fileOf(theme))).toBe(true);
  });

  const css = existsSync(fileOf(theme)) ? readFileSync(fileOf(theme), "utf8") : "";
  const dark = hexes(block(css, `[data-theme="${theme}"]`), "--color-");
  const light = hexes(block(css, `[data-theme="${theme}"][data-mode="light"]`), "--color-");
  const auto = hexes(block(css, `  [data-theme="${theme}"][data-mode="auto"]`), "--color-");

  it("claro y automático-en-claro son idénticos, y redefinen el set oscuro", () => {
    expect(auto).toEqual(light);
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });

  it.each([
    ["oscuro", dark],
    ["claro", light],
  ])("%s: el texto cumple AAA contra el fondo y la superficie", (_mode, colors) => {
    for (const text of ["--color-fg", "--color-fg-muted", "--color-live"]) {
      for (const background of ["--color-bg", "--color-surface"]) {
        const ratio = contrast(colors[text] ?? "", colors[background] ?? "");
        expect(ratio, `${text} sobre ${background}`).toBeGreaterThanOrEqual(7);
      }
    }
    expect(
      contrast(colors["--color-live-ink"] ?? "", colors["--color-live"] ?? ""),
    ).toBeGreaterThanOrEqual(7);
    expect(
      contrast(colors["--color-selection-fg"] ?? "", colors["--color-selection-bg"] ?? ""),
    ).toBeGreaterThanOrEqual(7);
  });

  it.each(THEME_RULES[theme].accents)(
    "acento %s: AAA en los dos modos, también bajo un destacado",
    (accent) => {
      const tones = hexes(
        block(css, `[data-theme="${theme}"][data-accent="${accent}"]`),
        "--accent-",
      );
      for (const [tone, colors] of [
        ["--accent-on-dark", dark],
        ["--accent-on-light", light],
      ] as const) {
        expect(tones[tone], `${accent} sin ${tone}`).toMatch(/^#[0-9a-f]{6}$/);
        for (const background of ["--color-bg", "--color-surface"]) {
          expect(contrast(tones[tone] ?? "", colors[background] ?? "")).toBeGreaterThanOrEqual(7);
        }
        const highlighted = mix(tones[tone] ?? "", colors["--color-bg"] ?? "", tint);
        for (const text of ["--color-fg", "--color-fg-muted", "--color-live"]) {
          expect(
            contrast(colors[text] ?? "", highlighted),
            `${accent} ${tone}: ${text}`,
          ).toBeGreaterThanOrEqual(7);
        }
      }
    },
  );

  it("el respaldo del acento es el tono del acento por defecto", () => {
    const fallback = (selector: string, tone: string) =>
      new RegExp(String.raw`--color-accent:\s*var\(--accent-on-${tone},\s*(#[0-9a-f]{6})\)`).exec(
        block(css, selector),
      )?.[1];
    const tones = hexes(
      block(css, `[data-theme="${theme}"][data-accent="${THEME_RULES[theme].defaultAccent}"]`),
      "--accent-",
    );
    expect(fallback(`[data-theme="${theme}"]`, "dark")).toBe(tones["--accent-on-dark"]);
    expect(fallback(`[data-theme="${theme}"][data-mode="light"]`, "light")).toBe(
      tones["--accent-on-light"],
    );
  });
});

describe("subte: cada línea tiene su color", () => {
  const css = readFileSync(fileOf("subte"), "utf8");

  it.each(THEME_RULES.subte.accents)(
    "con %s, las cuatro líneas son distintas en los dos modos",
    (accent) => {
      const tones = hexes(block(css, `[data-theme="subte"][data-accent="${accent}"]`), "--");
      for (const mode of ["dark", "light"]) {
        const lines = [
          tones[`--accent-on-${mode}`],
          tones[`--line-2-on-${mode}`],
          tones[`--line-3-on-${mode}`],
          tones[`--line-4-on-${mode}`],
        ];
        expect(lines.every((line) => /^#[0-9a-f]{6}$/.test(line ?? ""))).toBe(true);
        expect(new Set(lines).size).toBe(4);
      }
    },
  );
});
