// Entrada del Worker: `fetch` lo atiende Astro y `scheduled` corre los cron.
import { handle } from "@astrojs/cloudflare/handler";

import { featuredRefresh } from "@/composition/runtime";

/** Cada hora: el contenido destacado de YouTube (SPEC-live-status). */
// Sin `export`: workerd toma cada export del módulo como un handler.
const FEATURED_CRON = "0 * * * *";

export default {
  fetch: handle,

  // El en vivo (tarea 26) se suma acá con su propio cron. Cada trabajo tiene su
  // lock en la base, así dos corridas no se pisan.
  scheduled(controller, _env, context) {
    if (controller.cron !== FEATURED_CRON) {
      console.info("cron: sin trabajo", { cron: controller.cron });
      return;
    }
    const refresh = featuredRefresh();
    if (!refresh) {
      console.warn("cron: falta YOUTUBE_API_KEY; no se refresca el contenido destacado");
      return;
    }
    context.waitUntil(
      refresh().then(
        (summary) => {
          console.info("cron: contenido destacado", summary);
        },
        (error: unknown) => {
          console.error("cron: el refresco del contenido destacado falló", error);
        },
      ),
    );
  },
} satisfies ExportedHandler<Env>;
