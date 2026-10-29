// Aviso de vencimiento de los tokens de la CI (tarea 9c). Lo corre el workflow
// semanal `tokens.yml`: si a un token le quedan 14 días o menos, abre un issue
// (uno solo por token: si ya hay uno abierto, no repite). Las fechas viven en
// variables del repo que actualiza `scripts/renovar-token.sh` al renovar.
//
//   SUPABASE_TOKEN_EXPIRES_ON=2027-01-13 CLOUDFLARE_TOKEN_EXPIRES_ON=2027-10-14 node scripts/token-expiry.ts
//   TODAY=2027-01-01 simula otra fecha (para probar con workflow_dispatch).
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const WARNING_DAYS = 14;
export const ISSUE_LABEL = "token-por-vencer";

export interface CiToken {
  /** Nombre visible y variable del repo que guarda su vencimiento. */
  name: string;
  variable: string;
  /** Proveedor que entiende `scripts/renovar-token.sh`. */
  provider: "supabase" | "cloudflare";
}

export const CI_TOKENS: readonly CiToken[] = [
  {
    name: "Supabase (plektia-ci)",
    variable: "SUPABASE_TOKEN_EXPIRES_ON",
    provider: "supabase",
  },
  {
    name: "Cloudflare (plektia-deploy-ci)",
    variable: "CLOUDFLARE_TOKEN_EXPIRES_ON",
    provider: "cloudflare",
  },
];

export type TokenCheck =
  | { token: CiToken; status: "ok" | "soon" | "expired"; expiresOn: string; daysLeft: number }
  | { token: CiToken; status: "missing" | "invalid"; value: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Días enteros (UTC) entre dos fechas AAAA-MM-DD; `null` si alguna no es válida. */
export function daysBetween(from: string, to: string): number | null {
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) return null;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  // Date.parse acepta 2027-02-30 y lo corre de mes: se rechaza comparando de vuelta.
  if (new Date(end).toISOString().slice(0, 10) !== to) return null;
  return Math.round((end - start) / 86_400_000);
}

export function checkToken(token: CiToken, value: string | undefined, today: string): TokenCheck {
  const expiresOn = (value ?? "").trim();
  if (expiresOn === "") return { token, status: "missing", value: expiresOn };
  const daysLeft = daysBetween(today, expiresOn);
  if (daysLeft === null) return { token, status: "invalid", value: expiresOn };
  const status = daysLeft < 0 ? "expired" : daysLeft <= WARNING_DAYS ? "soon" : "ok";
  return { token, status, expiresOn, daysLeft };
}

/** Título fijo por token: es la clave para no abrir dos issues del mismo. */
export function issueTitle(token: CiToken): string {
  return `Renovar el token de ${token.name} de la CI`;
}

export function issueBody(check: Extract<TokenCheck, { expiresOn: string }>): string {
  const when =
    check.status === "expired"
      ? `**Venció el ${check.expiresOn}.** Los deploys fallan hasta que se renueve.`
      : `Vence el **${check.expiresOn}** (en ${String(check.daysLeft)} días).`;
  return [
    when,
    "",
    "Para renovarlo (crea el token nuevo con los mismos permisos, lo verifica, lo guarda en GitHub y actualiza la fecha):",
    "",
    "```bash",
    `bash scripts/renovar-token.sh ${check.token.provider}`,
    "```",
    "",
    "Después borrá el token anterior en el panel del proveedor y cerrá este issue.",
    "",
    "_Abierto por el workflow semanal `tokens.yml`._",
  ].join("\n");
}

function gh(args: readonly string[]): string {
  return execFileSync("gh", args, { encoding: "utf8" });
}

function openIssueExists(title: string): boolean {
  const titles = gh([
    "issue",
    "list",
    "--state",
    "open",
    "--label",
    ISSUE_LABEL,
    "--json",
    "title",
    "--jq",
    ".[].title",
  ]);
  return titles.split("\n").includes(title);
}

function main(): void {
  const simulated = process.env["TODAY"]?.trim() ?? "";
  const today = simulated === "" ? new Date().toISOString().slice(0, 10) : simulated;
  if (daysBetween(today, today) === null) {
    console.error(`TODAY no es una fecha AAAA-MM-DD: "${today}".`);
    process.exit(2);
  }
  let problems = 0;
  for (const token of CI_TOKENS) {
    const check = checkToken(token, process.env[token.variable], today);
    if ("value" in check) {
      // Sin fecha no se puede avisar: falla el workflow para que se note.
      console.error(`::error::${token.variable} falta o no es AAAA-MM-DD ("${check.value}").`);
      problems += 1;
      continue;
    }
    console.info(
      `${token.name}: vence ${check.expiresOn} (${String(check.daysLeft)} días) → ${check.status}`,
    );
    if (check.status === "ok") continue;
    const title = issueTitle(token);
    if (openIssueExists(title)) {
      console.info(`  Ya hay un issue abierto: "${title}".`);
      continue;
    }
    gh(["issue", "create", "--title", title, "--label", ISSUE_LABEL, "--body", issueBody(check)]);
    console.info(`  Issue abierto: "${title}".`);
  }
  if (problems > 0) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
