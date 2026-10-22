// Invita a una persona: suma su email a la allowlist con el handle que va a usar.
//
//   pnpm user:allow <email> <handle> [--role owner|member] [--prod]
//
// Sin `--prod` escribe en Supabase local; con `--prod`, en el proyecto enlazado
// (`supabase link`), a través de la API de gestión con tu sesión de la CLI. No usa
// la `service_role` key. La base valida además el formato del handle, que no esté
// reservado y que sea único (SPEC-identity).
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export interface Invite {
  readonly email: string;
  readonly handle: string;
  readonly role: "owner" | "member";
  readonly prod: boolean;
}

const EMAIL = /^[^\s@'"\\$]+@[^\s@'"\\$]+\.[^\s@'"\\$]+$/;
const HANDLE = /^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$/;

export function parseArgs(argv: readonly string[]): Invite | string {
  const positional = argv.filter((arg, i) => !arg.startsWith("--") && argv[i - 1] !== "--role");
  const [rawEmail, rawHandle] = positional;
  const roleIndex = argv.indexOf("--role");
  const role = roleIndex === -1 ? "member" : argv[roleIndex + 1];

  const email = rawEmail?.trim().toLowerCase() ?? "";
  const handle = rawHandle?.trim().toLowerCase() ?? "";
  if (positional.length !== 2)
    return "Uso: pnpm user:allow <email> <handle> [--role owner|member] [--prod]";
  if (email.length > 254 || !EMAIL.test(email)) return `Email inválido: ${rawEmail ?? ""}`;
  if (handle.length < 3 || handle.length > 30 || !HANDLE.test(handle)) {
    return `Handle inválido: ${rawHandle ?? ""} (3 a 30 caracteres: a-z, 0-9 y guiones simples)`;
  }
  if (role !== "owner" && role !== "member") return `Rol inválido: ${role ?? ""}`;
  return { email, handle, role, prod: argv.includes("--prod") };
}

/**
 * Los valores van entre comillas dólar con una etiqueta aleatoria: ningún
 * contenido puede cerrarlas, así que no hay inyección de SQL posible.
 */
export function buildSql(invite: Invite, tag = `v${randomBytes(8).toString("hex")}`): string {
  const quote = (value: string) => `$${tag}$${value}$${tag}$`;
  return [
    "insert into private.allowed_emails (email, handle, role)",
    `values (${quote(invite.email)}, ${quote(invite.handle)}, ${quote(invite.role)}::public.user_role);`,
  ].join("\n");
}

function main(): void {
  const invite = parseArgs(process.argv.slice(2));
  if (typeof invite === "string") {
    console.error(invite);
    process.exit(1);
  }

  // El SQL viaja en un archivo: nunca pasa por la línea de comandos ni por un shell.
  const dir = mkdtempSync(join(tmpdir(), "plektia-"));
  const file = join(dir, "allow-user.sql");
  try {
    writeFileSync(file, buildSql(invite), { mode: 0o600 });
    const target = invite.prod ? "--linked" : "--local";
    execFileSync(process.execPath, [supabaseCli(), "db", "query", target, "--file", file], {
      stdio: "inherit",
    });
    console.warn(`Invitación creada: ${invite.email} → /${invite.handle} (${invite.role}).`);
    if (invite.prod) {
      // Mientras el registro esté cerrado, la app de Google sigue en "Prueba":
      // solo entran con Google los usuarios de prueba cargados a mano.
      console.warn(
        "Si va a entrar con Google, agregalo como usuario de prueba en " +
          "https://console.cloud.google.com/auth/audience",
      );
    }
  } catch {
    // La CLI ya mostró el motivo (handle reservado o repetido, email ya invitado…).
    console.error("No se creó la invitación: revisá el error de arriba.");
    process.exitCode = 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** El binario de la CLI instalado como dependencia (sin depender del PATH ni de un shell). */
function supabaseCli(): string {
  return join(process.cwd(), "node_modules", "supabase", "dist", "supabase.js");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
