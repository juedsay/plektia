// Contrato con la YouTube Data API real (SPEC-live-status, "Testing"): verifica
// que las playlists derivadas UULF (videos), UUSH (Shorts) y UULV (directos)
// sigan existiendo y que la key funcione en el header `X-Goog-Api-Key`. Si
// alguna falla, el adaptador usa el plan B (más cuota): conviene revisarlo.
//
// Uso: pnpm contract:youtube [@handle]
// La key se lee de `.dev.vars` (YOUTUBE_API_KEY); nunca se imprime.
// Cuesta 4 unidades de las 10.000 diarias.
import { readFileSync } from "node:fs";

const API = "https://www.googleapis.com/youtube/v3";
const handle = process.argv[2] ?? "@YouTube";

function apiKey(): string {
  if (process.env["YOUTUBE_API_KEY"]) return process.env["YOUTUBE_API_KEY"];
  try {
    const line = readFileSync(".dev.vars", "utf8")
      .split(/\r?\n/)
      .find((candidate) => candidate.startsWith("YOUTUBE_API_KEY="));
    const value = line?.slice("YOUTUBE_API_KEY=".length).trim().replace(/^"|"$/g, "");
    if (value) return value;
  } catch {
    // Sin .dev.vars: se avisa abajo.
  }
  console.error("Falta YOUTUBE_API_KEY (en .dev.vars o en el entorno).");
  process.exit(2);
}

const key = apiKey();

async function get(resource: string, params: Record<string, string>) {
  const url = new URL(`${API}/${resource}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, {
    headers: { "X-Goog-Api-Key": key, Accept: "application/json" },
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, json: await response.json<Record<string, unknown>>() };
}

const channel = await get("channels", { part: "id", forHandle: handle });
const items = channel.json["items"] as { id: string }[] | undefined;
const channelId = items?.[0]?.id;
if (channel.status !== 200 || !channelId) {
  console.error(`No se pudo resolver ${handle} (HTTP ${String(channel.status)}).`);
  process.exit(1);
}
console.info(`${handle} → ${channelId}`);

let failures = 0;
for (const [prefix, name] of [
  ["UULF", "videos"],
  ["UUSH", "Shorts"],
  ["UULV", "directos"],
] as const) {
  const playlist = await get("playlistItems", {
    part: "contentDetails",
    playlistId: prefix + channelId.slice(2),
    maxResults: "1",
  });
  const ok = playlist.status === 200;
  if (!ok) failures++;
  console.info(`${ok ? "ok " : "MAL"} ${prefix} (${name}): HTTP ${String(playlist.status)}`);
}

if (failures > 0) {
  console.error(
    "Alguna playlist derivada no respondió. Si el canal tiene de ese tipo, la convención cambió: revisar el plan B.",
  );
  process.exit(1);
}
console.info("Contrato con YouTube: ok.");
