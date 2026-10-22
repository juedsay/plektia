// Presupuestos de rendimiento de la página pública (SPEC-public-page,
// "Presupuestos de rendimiento"). Corre Lighthouse (celular y 4G lento, la
// configuración por defecto) contra un build ya levantado, y falla si alguna
// página excede un presupuesto.
//
//   node scripts/lighthouse.ts http://127.0.0.1:4323
//
// Los pesos de JS, CSS y HTML se miden con gzip sobre lo que la página pide:
// el servidor local no comprime como Cloudflare y Lighthouse vería de más.
import { gzipSync } from "node:zlib";

import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";

const BUDGETS = {
  // La fuente de la marca (77 KB, ejes de peso y tamaño óptico) cae en el
  // camino del LCP con 4G lento: oscila entre ~1.05 y ~1.6 s. Decisión
  // revisable (SPEC-public-page): sin el eje óptico pesa 41 KB y baja a ~1.05 s.
  lcpMs: 1800,
  // La fuente de la marca reemplaza a la de respaldo (métricas ajustadas): deja
  // corrimientos de fracciones de píxel (~0.0003). "0" en la práctica.
  cls: 0.001,
  tbtMs: 50,
  jsBytes: 8 * 1024,
  cssBytes: 12 * 1024,
  htmlBytes: 30 * 1024,
  thirdPartyRequests: 0,
  minScore: 0.95,
};

// Perfiles, páginas del sitio y el perfil de 50 links del seed (peor caso de HTML).
const PAGES = ["/", "/plektia", "/juedsay", "/miembro-demo", "/legal/privacy"];
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;
const PORT = 9333;
const RUNS = 3;

type LhrLike = NonNullable<Awaited<ReturnType<typeof lighthouse>>>["lhr"];

const base = process.argv[2];
if (!base) {
  console.error("Uso: node scripts/lighthouse.ts <url-base>");
  process.exit(2);
}
const origin = new URL(base).origin;

async function gzipped(url: string): Promise<number> {
  const body = new Uint8Array(await (await fetch(url)).arrayBuffer());
  return gzipSync(body, { level: 9 }).byteLength;
}

interface NetworkItem {
  url: string;
  resourceType?: string;
}

const failures: string[] = [];
const rows: string[] = [];

// En Windows el control de aplicaciones bloquea el Chromium descargado: Edge.
const browser = await chromium.launch({
  args: [`--remote-debugging-port=${String(PORT)}`],
  ...(process.platform === "win32" ? { channel: "msedge" } : {}),
});

try {
  for (const path of PAGES) {
    const url = new URL(path, base).href;
    const fail = (what: string) => failures.push(`${path}: ${what}`);
    // Varias corridas y la mediana de cada métrica (lo que recomienda Lighthouse):
    // una sola medición varía lo suficiente como para volver intermitente la CI.
    // Una corrida que no logra grabar la carga (NO_NAVSTART) se repite.
    const runs: LhrLike[] = [];
    for (let attempt = 0; runs.length < RUNS && attempt < RUNS + 2; attempt++) {
      const result = await lighthouse(url, { port: PORT, output: "json", logLevel: "error" });
      if (result && !result.lhr.runtimeError) runs.push(result.lhr);
    }
    const lhr = runs[0];
    // Sin las tres corridas no hay mediana: mejor fallar que aprobar con una sola.
    if (!lhr || runs.length < RUNS) {
      fail(`Lighthouse midió ${String(runs.length)} de ${String(RUNS)} corridas`);
      continue;
    }
    const median = (values: number[]) => {
      const sorted = [...values].sort((smaller, larger) => smaller - larger);
      return sorted[Math.floor(sorted.length / 2)] ?? Number.POSITIVE_INFINITY;
    };
    const metric = (id: string) =>
      median(runs.map((request) => request.audits[id]?.numericValue ?? Number.POSITIVE_INFINITY));
    const scoreOf = (id: (typeof CATEGORIES)[number]) =>
      median(runs.map((request) => request.categories[id]?.score ?? 0));

    for (const id of CATEGORIES) {
      const score = scoreOf(id);
      if (score < BUDGETS.minScore) fail(`${id} ${String(Math.round(score * 100))} < 95`);
    }
    const lcp = metric("largest-contentful-paint");
    const cls = metric("cumulative-layout-shift");
    const tbt = metric("total-blocking-time");
    if (lcp > BUDGETS.lcpMs) fail(`LCP ${String(Math.round(lcp))} ms > ${String(BUDGETS.lcpMs)}`);
    if (cls > BUDGETS.cls) fail(`CLS ${cls.toFixed(4)} > ${String(BUDGETS.cls)}`);
    if (tbt > BUDGETS.tbtMs) fail(`TBT ${String(Math.round(tbt))} ms > ${String(BUDGETS.tbtMs)}`);

    const details = lhr.audits["network-requests"]?.details as
      { items?: NetworkItem[] } | undefined;
    const requests = details?.items ?? [];
    const thirdParty = requests.filter(
      (request) => !request.url.startsWith(origin) && !request.url.startsWith("data:"),
    );
    if (thirdParty.length > BUDGETS.thirdPartyRequests) {
      fail(`pedidos a terceros: ${thirdParty.map((request) => request.url).join(", ")}`);
    }

    const sizeOf = async (type: string) => {
      const urls = requests
        .filter((request) => request.resourceType === type)
        .map((request) => request.url);
      const sizes = await Promise.all(urls.map(gzipped));
      return sizes.reduce((total, size) => total + size, 0);
    };
    const js = await sizeOf("Script");
    // El CSS va en línea (astro.config.mjs): se suma lo de los <style> del HTML,
    // además de cualquier hoja externa, para que el presupuesto siga vigilándolo.
    const document = await (await fetch(url)).text();
    const inlineCss = [...document.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
      .map((match) => match[1] ?? "")
      .join("");
    const css =
      (await sizeOf("Stylesheet")) +
      (inlineCss ? gzipSync(new TextEncoder().encode(inlineCss), { level: 9 }).byteLength : 0);
    const html = await gzipped(url);
    if (js > BUDGETS.jsBytes) fail(`JS ${String(js)} B > ${String(BUDGETS.jsBytes)}`);
    if (css > BUDGETS.cssBytes) fail(`CSS ${String(css)} B > ${String(BUDGETS.cssBytes)}`);
    if (html > BUDGETS.htmlBytes) fail(`HTML ${String(html)} B > ${String(BUDGETS.htmlBytes)}`);

    const scores = CATEGORIES.map((id) => String(Math.round(scoreOf(id) * 100)));
    rows.push(
      `${path.padEnd(16)} ${scores.join("/").padEnd(15)} LCP ${String(Math.round(lcp)).padStart(5)} ms  ` +
        `CLS ${cls.toFixed(3)}  TBT ${String(Math.round(tbt)).padStart(3)} ms  ` +
        `JS ${(js / 1024).toFixed(1)} KB  CSS ${(css / 1024).toFixed(1)} KB  HTML ${(html / 1024).toFixed(1)} KB`,
    );
  }
} finally {
  await browser.close();
}

console.info("página           perf/a11y/bp/seo");
for (const row of rows) console.info(row);
if (failures.length > 0) {
  console.error(`\nPresupuestos excedidos:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.info("\nTodos los presupuestos se cumplen.");
