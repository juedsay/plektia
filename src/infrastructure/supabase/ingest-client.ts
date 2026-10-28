import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/infrastructure/supabase/database.types";

// Único módulo que conoce la clave de servicio de Supabase (SPEC-platform,
// "Secretos"; una regla de Semgrep lo hace cumplir). Solo invoca funciones
// `ingest_*`, que validan y acotan lo que escriben: nunca da acceso libre a tablas.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- así se amplían los tipos de Workers.
  namespace Cloudflare {
    interface Env {
      /** Secreto del Worker (`wrangler secret put`); en local, `.dev.vars`. */
      SUPABASE_SECRET_KEY: string;
    }
  }
}

type Functions = Database["public"]["Functions"];
export type IngestFunction = Extract<keyof Functions, `ingest_${string}`>;

export interface IngestError {
  readonly code: string;
  readonly message: string;
}

export interface IngestClient {
  /** `data` es lo que devuelve la función (`null` si falló). */
  call<F extends IngestFunction>(
    fn: F,
    args: Functions[F]["Args"],
  ): Promise<{ data: Functions[F]["Returns"] | null; error: IngestError | null }>;
}

/** Lo que necesita el cliente de ingesta del entorno del Worker. */
export interface IngestConfig {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_SECRET_KEY?: string;
}

export function createIngestClient(env: IngestConfig): IngestClient {
  const key = env.SUPABASE_SECRET_KEY;
  if (!env.SUPABASE_URL || !key) {
    throw new Error("ingest: falta SUPABASE_URL o la clave de servicio");
  }
  const client = createClient<Database>(env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    async call(fn, args) {
      const { data, error } = await client.rpc(fn, args);
      if (error) return { data: null, error: { code: error.code, message: error.message } };
      return { data, error: null };
    },
  };
}
