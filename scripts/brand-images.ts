// Genera las imágenes de marca que necesitan PNG (los SVG no sirven para
// Open Graph ni para el ícono de iOS). Corre una vez y el resultado se versiona:
//
//   node scripts/brand-images.ts
//
// Usa el navegador de Playwright para dibujar HTML con la fuente de la marca.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "@playwright/test";

const root = process.cwd();
const icon = readFileSync(join(root, "docs/brand/plektia/app-icon.svg"), "utf8");
const isotype = readFileSync(join(root, "docs/brand/plektia/isotipo-fondo-oscuro.svg"), "utf8");
// Embebida: una página armada con setContent no puede leer archivos locales.
const font = `data:font/woff2;base64,${readFileSync(
  join(
    root,
    "node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2",
  ),
).toString("base64")}`;

const og = `<!doctype html><html><head><style>
  @font-face { font-family: Brand; src: url("${font}") format("woff2"); font-weight: 200 800; }
  html, body { margin: 0; width: 1200px; height: 630px; background: #121315; color: #f2f2ee; }
  body { display: grid; place-content: center; justify-items: center; gap: 28px; font-family: Brand, sans-serif; }
  svg { width: 168px; height: 168px; }
  h1 { margin: 0; font-size: 104px; font-weight: 500; letter-spacing: -0.02em; line-height: 1; }
  p { margin: 0; font-size: 40px; color: #aeb1b7; font-weight: 400; }
</style></head><body>${isotype}<h1>plektia</h1><p>Todo tejido.</p></body></html>`;

const touch = `<!doctype html><html><head><style>
  html, body { margin: 0; width: 180px; height: 180px; background: #121315; }
  svg { display: block; width: 180px; height: 180px; }
</style></head><body>${icon.replace('rx="14"', 'rx="0"')}</body></html>`;

// En Windows el control de aplicaciones bloquea el Chromium descargado: se usa Edge.
const browser = await chromium.launch(process.platform === "win32" ? { channel: "msedge" } : {});
try {
  const page = await browser.newPage();
  for (const [html, width, height, file] of [
    [og, 1200, 630, "public/og.png"],
    [touch, 180, 180, "public/apple-touch-icon.png"],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(root, file) });
    console.info(`generada ${file}`);
  }
} finally {
  await browser.close();
}
