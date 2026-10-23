// Presupuesto de la isla del editor (SPEC-admin-panel, "Criterios de éxito"):
// suma el gzip de todo lo que carga la isla (el componente, el renderer de
// React y sus imports) y falla si pasa el límite. Corre después de `pnpm build`.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ASSETS = join(process.cwd(), "dist", "client", "_astro");
/** React 19 ya pesa ~67 KB gzip (decisión del 2026-10-23: React, con presupuesto ajustado). */
const BUDGET_KB = 90;
/** Puntos de entrada de la isla: el componente y el renderer de Astro para React. */
const ENTRY_PATTERNS = [/^Editor\.[\w-]+\.js$/, /^client\.[\w-]+\.js$/];

const files = readdirSync(ASSETS);
const entries = files.filter((file) => ENTRY_PATTERNS.some((pattern) => pattern.test(file)));
if (entries.length !== ENTRY_PATTERNS.length) {
  console.error(`No se encontraron los archivos de la isla en ${ASSETS}: ¿corriste pnpm build?`);
  process.exit(2);
}

// Recorre los imports estáticos y dinámicos ("./react.X.js") de cada archivo.
const IMPORT = /(?:from|import)\s*\(?\s*["']\.\/([\w.-]+\.js)["']/g;
const visited = new Set<string>();
const pending = [...entries];
while (pending.length > 0) {
  const file = pending.pop();
  if (!file || visited.has(file)) continue;
  visited.add(file);
  const source = readFileSync(join(ASSETS, file), "utf8");
  for (const match of source.matchAll(IMPORT)) {
    if (match[1]) pending.push(match[1]);
  }
}

let totalBytes = 0;
for (const file of [...visited].sort()) {
  const gzipped = gzipSync(readFileSync(join(ASSETS, file)), { level: 9 }).length;
  totalBytes += gzipped;
  console.info(`${file.padEnd(40)} ${(gzipped / 1024).toFixed(1).padStart(6)} KB`);
}
const totalKb = totalBytes / 1024;
console.info(
  `${"Total de la isla".padEnd(40)} ${totalKb.toFixed(1).padStart(6)} KB (máximo ${String(BUDGET_KB)})`,
);
if (totalKb > BUDGET_KB) {
  console.error(
    `La isla del editor pasa el presupuesto: ${totalKb.toFixed(1)} KB > ${String(BUDGET_KB)} KB.`,
  );
  process.exit(1);
}
