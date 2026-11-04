import { createHash } from "node:crypto";

import type { Theme } from "@/domain/theme";

import bitmap from "./bitmap.css?inline";
import cassette from "./cassette.css?inline";
import corcho from "./corcho.css?inline";
import lomo from "./lomo.css?inline";
import manual from "./manual.css?inline";
import pedalera from "./pedalera.css?inline";
import punto from "./punto.css?inline";
import subte from "./subte.css?inline";
import sumario from "./sumario.css?inline";

// La hoja de cada variante, ya minificada, para ponerla en línea en la página
// pública: como page.css, no suma un pedido que bloquee el primer render. La
// CSP no admite estilos en línea sin hash: `styleHash` lo calcula una vez por
// variante y la página lo agrega con `Astro.csp.insertStyleHash`. Es sincrónico
// a propósito: el layout corre mientras Astro ya transmite la respuesta, y un
// `await` ahí deja el hash afuera de la cabecera en la primera visita.
// El panel sigue enlazando los archivos (index.ts): ahí se cargan todas juntas.
export const THEME_INLINE_STYLES: Readonly<Partial<Record<Theme, string>>> = {
  punto,
  bitmap,
  cassette,
  corcho,
  subte,
  lomo,
  manual,
  sumario,
  pedalera,
};

type StyleHash = `sha256-${string}`;

const hashes = new Map<string, StyleHash>();

/** El hash `sha256-…` de un texto, como lo pide la CSP para un `<style>`. */
export function styleHash(css: string): StyleHash {
  let hash = hashes.get(css);
  if (!hash) {
    hash = `sha256-${createHash("sha256").update(css, "utf8").digest("base64")}`;
    hashes.set(css, hash);
  }
  return hash;
}
