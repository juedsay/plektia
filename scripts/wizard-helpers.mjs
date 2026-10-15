// Ayudantes de scripts/configurar-auth.sh: manejan JSON y
// secretos en Node para que nunca pasen por la línea de comandos ni por el shell.
//
//   node scripts/wizard-helpers.mjs auth-config-<urls|hook|providers>  (env → stdout: JSON)
//   node scripts/wizard-helpers.mjs verify-auth       (stdin: config de Auth)

/** JSON de la entrada estándar; si llega vacío (la API falló), termina con un aviso claro. */
const readJson = async () => {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  if (input.trim() === "") {
    console.error("  Supabase no devolvió datos (revisá el token y sus permisos).");
    process.exit(1);
  }
  return JSON.parse(input);
};

const commands = {
  // La configuración de Auth va en partes, para saber cuál rechaza Supabase.
  async "auth-config-urls"() {
    process.stdout.write(
      JSON.stringify({
        site_url: process.env.APP_URL,
        uri_allow_list: `${process.env.APP_URL ?? ""}/auth/callback`,
        external_email_enabled: false,
        external_phone_enabled: false,
      }),
    );
  },

  async "auth-config-hook"() {
    process.stdout.write(
      JSON.stringify({
        hook_before_user_created_enabled: true,
        hook_before_user_created_uri: process.env.HOOK_URI,
      }),
    );
  },

  async "auth-config-providers"() {
    const env = process.env;
    process.stdout.write(
      JSON.stringify({
        external_github_enabled: true,
        external_github_client_id: env.GITHUB_CLIENT_ID,
        external_github_secret: env.GITHUB_SECRET,
        external_google_enabled: true,
        external_google_client_id: env.GOOGLE_CLIENT_ID,
        external_google_secret: env.GOOGLE_SECRET,
      }),
    );
  },

  // Muestra solo los campos no secretos y falla si alguno no quedó como se pidió.
  async "verify-auth"() {
    const config = await readJson();
    const expected = {
      site_url: process.env.APP_URL,
      external_email_enabled: false,
      external_github_enabled: true,
      external_google_enabled: true,
      hook_before_user_created_enabled: true,
      hook_before_user_created_uri: process.env.HOOK_URI,
    };
    let ok = true;
    for (const [key, value] of Object.entries(expected)) {
      const good = config[key] === value;
      ok &&= good;
      console.info(`  ${good ? "✓" : "✗"} ${key} = ${JSON.stringify(config[key])}`);
    }
    process.exit(ok ? 0 : 1);
  },
};

const command = commands[process.argv[2] ?? ""];
if (!command) {
  console.error(`Uso: node scripts/wizard-helpers.mjs <${Object.keys(commands).join("|")}>`);
  process.exit(1);
}
await command();
