// Contrato con la API real de Twitch (SPEC-live-status, "Testing"): verifica
// que el token de aplicación (client credentials) funcione y que `GET /streams`
// responda con la forma que lee el adaptador.
//
// Uso: pnpm contract:twitch [login]
// Las credenciales se leen de `.dev.vars` (TWITCH_CLIENT_ID y
// TWITCH_CLIENT_SECRET); nunca se imprimen.
import { readFileSync } from "node:fs";

const login = (process.argv[2] ?? "twitch").toLowerCase();

function variable(name: string): string {
  const fromEnvironment = process.env[name];
  if (fromEnvironment) return fromEnvironment;
  try {
    const line = readFileSync(".dev.vars", "utf8")
      .split(/\r?\n/)
      .find((candidate) => candidate.startsWith(`${name}=`));
    const value = line
      ?.slice(name.length + 1)
      .trim()
      .replace(/^"|"$/g, "");
    if (value) return value;
  } catch {
    // Sin .dev.vars: se avisa abajo.
  }
  console.error(`Falta ${name} (en .dev.vars o en el entorno).`);
  process.exit(2);
}

const clientId = variable("TWITCH_CLIENT_ID");
const clientSecret = variable("TWITCH_CLIENT_SECRET");

const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
  method: "POST",
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  }),
  redirect: "manual",
  signal: AbortSignal.timeout(10_000),
});
const token = await tokenResponse.json<{ access_token?: string }>();
if (tokenResponse.status !== 200 || !token.access_token) {
  console.error(`No se pudo obtener el token (HTTP ${String(tokenResponse.status)}).`);
  process.exit(1);
}
console.info("Token de aplicación: ok");

const streams = await fetch(
  `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`,
  {
    headers: { "Client-Id": clientId, Authorization: `Bearer ${token.access_token}` },
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  },
);
const body = await streams.json<{ data?: { type: string }[] }>();
if (streams.status !== 200 || !Array.isArray(body.data)) {
  console.error(`GET /streams no respondió como se esperaba (HTTP ${String(streams.status)}).`);
  process.exit(1);
}
const live = body.data.some((stream) => stream.type === "live");
console.info(`${login}: ${live ? "en vivo" : "offline"}`);
console.info("Contrato con Twitch: ok.");
