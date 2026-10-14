// Entrada del Worker: `fetch` lo atiende Astro y `scheduled` corre el cron.
import { handle } from "@astrojs/cloudflare/handler";

export default {
  fetch: handle,

  // El cron de `live-status` (fase F6) se conecta acá a través de `composition/`:
  // actualiza el estado en vivo y purga por etiqueta las páginas afectadas (ADR 0003).
  scheduled(controller) {
    console.info("cron: ejecutado", { cron: controller.cron });
  },
} satisfies ExportedHandler<Env>;
