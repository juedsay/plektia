// Entrada del Worker (ADR 0003). Dos entradas:
// - `default`, sin caché: corre en cada pedido, arma la clave de caché sin los
//   parámetros de seguimiento y le pasa el pedido a `App`. Los cron también
//   llegan acá y se los pasa a `App`.
// - `App`, con caché: es la app de Astro. Las purgas tienen que correr acá
//   adentro, porque cada purga solo alcanza la caché de la entrada que la hace.
import { handle } from "@astrojs/cloudflare/handler";
import { WorkerEntrypoint } from "cloudflare:workers";

import { featuredRefresh, liveRefresh, statsPurge } from "@/composition/runtime";
import { cacheKeyFor, forwardedRequest } from "@/infrastructure/http/gateway";

// Deben coincidir con `triggers.crons` de wrangler.jsonc.
/** Cada 10 minutos: el estado en vivo de los canales vigilados. */
const LIVE_CRON = "*/10 * * * *";
/** Cada hora: el contenido destacado de YouTube. */
const FEATURED_CRON = "0 * * * *";
/** El día 1 de cada mes: las estadísticas de hace más de 400 días se borran. */
const STATS_RETENTION_CRON = "30 3 1 * *";

/** Cada trabajo del cron, con su nombre para los logs. */
const JOBS: Readonly<
  Record<string, { name: string; build: () => (() => Promise<unknown>) | null }>
> = {
  [LIVE_CRON]: { name: "en vivo", build: liveRefresh },
  [FEATURED_CRON]: { name: "contenido destacado", build: featuredRefresh },
  [STATS_RETENTION_CRON]: { name: "retención de estadísticas", build: statsPurge },
};

/** La app de Astro, detrás de la caché del Worker. */
export class App extends WorkerEntrypoint<Env> {
  override fetch(request: Request): Promise<Response> {
    return handle(request, this.env, this.ctx);
  }

  /** Un trabajo del cron (por RPC, que no pasa por la caché): sus purgas son de esta entrada. */
  async runScheduled(cron: string): Promise<void> {
    const job = JOBS[cron];
    if (!job) {
      console.info("cron: sin trabajo", { cron });
      return;
    }
    const run = job.build();
    if (!run) {
      console.warn(`cron: ${job.name} sin credenciales del proveedor; no se refresca`);
      return;
    }
    // Cada trabajo tiene su lock en la base, así dos corridas no se pisan.
    try {
      console.info(`cron: ${job.name}`, await run());
    } catch (error) {
      console.error(`cron: el refresco de ${job.name} falló`, error);
    }
  }
}

export default {
  fetch(request, _env, context) {
    const forwarded = forwardedRequest(request, request.cf?.country);
    const cacheKey = cacheKeyFor(request.method, new URL(request.url));
    return context.exports.App.fetch(forwarded, cacheKey ? { cf: { cacheKey } } : undefined);
  },

  scheduled(controller, _env, context) {
    context.waitUntil(context.exports.App.runScheduled(controller.cron));
  },
} satisfies ExportedHandler<Env>;
