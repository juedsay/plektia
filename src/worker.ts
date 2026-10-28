// Entrada del Worker: `fetch` lo atiende Astro y `scheduled` corre los cron.
import { handle } from "@astrojs/cloudflare/handler";

import { featuredRefresh, liveRefresh } from "@/composition/runtime";

// Deben coincidir con `triggers.crons` de wrangler.jsonc. Sin `export`: workerd
// toma cada export del módulo como un handler.
/** Cada 10 minutos: el estado en vivo de los canales vigilados. */
const LIVE_CRON = "*/10 * * * *";
/** Cada hora: el contenido destacado de YouTube. */
const FEATURED_CRON = "0 * * * *";

/** Cada trabajo del cron, con su nombre para los logs. */
const JOBS: Readonly<
  Record<string, { name: string; build: () => (() => Promise<unknown>) | null }>
> = {
  [LIVE_CRON]: { name: "en vivo", build: liveRefresh },
  [FEATURED_CRON]: { name: "contenido destacado", build: featuredRefresh },
};

export default {
  fetch: handle,

  // Cada trabajo tiene su lock en la base, así dos corridas no se pisan.
  scheduled(controller, _env, context) {
    const job = JOBS[controller.cron];
    if (!job) {
      console.info("cron: sin trabajo", { cron: controller.cron });
      return;
    }
    const run = job.build();
    if (!run) {
      console.warn(`cron: ${job.name} sin credenciales del proveedor; no se refresca`);
      return;
    }
    context.waitUntil(
      run().then(
        (summary) => {
          console.info(`cron: ${job.name}`, summary);
        },
        (error: unknown) => {
          console.error(`cron: el refresco de ${job.name} falló`, error);
        },
      ),
    );
  },
} satisfies ExportedHandler<Env>;
