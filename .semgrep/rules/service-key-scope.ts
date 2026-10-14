// ruleid: plektia-service-key-scope
const key = env.SUPABASE_SECRET_KEY;
// ruleid: plektia-service-key-scope
const legacy = process.env["SUPABASE_SERVICE_ROLE_KEY"];
// ruleid: plektia-service-key-scope
const literal = "sb_secret_abc123";
// ok: plektia-service-key-scope
const publishable = env.SUPABASE_PUBLISHABLE_KEY;
