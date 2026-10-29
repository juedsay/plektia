import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ACCENTS } from "@/domain/page";

// Contrato de tokens (DESIGN.md, SPEC-appearance): cada modo de "técnico"
// cumple WCAG 2.2 AAA en la página pública, y "automático" en claro repite
// exactamente los valores de "claro" (nadie edita uno y se olvida del otro).

const css = readFileSync(join(process.cwd(), "src/ui/styles/tokens.css"), "utf8");

/** Las variables de color del primer bloque que empieza con `selector`. */
function colorsOf(selector: string, prefix = "--color-"): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`no está el bloque ${selector}`);
  const block = css.slice(start, css.indexOf("}", start));
  const declaration = new RegExp(String.raw`(${prefix}[\w-]+):\s*(#[0-9a-f]{6})`, "gi");
  return Object.fromEntries(
    [...block.matchAll(declaration)].map((match) => [
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

/** `color-mix(in srgb, top amount, bottom)`, como lo calcula el navegador. */
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

function contrast(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const dark = colorsOf('[data-theme="tecnico"]');
const light = colorsOf('[data-theme="tecnico"][data-mode="light"]');
const auto = colorsOf('  [data-theme="tecnico"][data-mode="auto"]');

describe("tokens de color", () => {
  it("claro y automático-en-claro son idénticos, y redefinen todo el set oscuro", () => {
    expect(auto).toEqual(light);
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });

  it.each([
    ["oscuro", dark],
    ["claro", light],
  ])("%s: el texto cumple AAA (7:1) contra el fondo y la superficie", (_mode, colors) => {
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
});

describe("acentos", () => {
  it.each(ACCENTS)("%s cumple AAA contra el fondo y la superficie de cada modo", (accent) => {
    const tones = colorsOf(`[data-accent="${accent}"]`, "--accent-");
    for (const [tone, colors] of [
      ["--accent-on-dark", dark],
      ["--accent-on-light", light],
    ] as const) {
      expect(tones[tone], `${accent} sin ${tone}`).toMatch(/^#[0-9a-f]{6}$/);
      for (const background of ["--color-bg", "--color-surface"]) {
        const ratio = contrast(tones[tone] ?? "", colors[background] ?? "");
        expect(ratio, `${accent} ${tone} sobre ${background}`).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it.each(ACCENTS)("%s: el texto sobre el fondo de un destacado sigue en AAA", (accent) => {
    const tint = Number(/--highlight-tint:\s*(\d+)%/.exec(css)?.[1]) / 100;
    expect(tint).toBeGreaterThan(0);
    const tones = colorsOf(`[data-accent="${accent}"]`, "--accent-");
    for (const [tone, colors] of [
      ["--accent-on-dark", dark],
      ["--accent-on-light", light],
    ] as const) {
      const background = mix(tones[tone] ?? "", colors["--color-bg"] ?? "", tint);
      for (const text of ["--color-fg", "--color-fg-muted", "--color-live"]) {
        const ratio = contrast(colors[text] ?? "", background);
        expect(ratio, `${accent} ${tone}: ${text}`).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it("hueso repite el texto de cada modo: las páginas de siempre no cambian", () => {
    expect(colorsOf('[data-accent="hueso"]', "--accent-")).toEqual({
      "--accent-on-dark": dark["--color-fg"],
      "--accent-on-light": light["--color-fg"],
    });
  });
});
