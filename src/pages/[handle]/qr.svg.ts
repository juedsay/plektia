import type { APIRoute } from "astro";

import { getPublicPage } from "@/application/public/get-public-page";
import { publicPages } from "@/composition/runtime";
import { qrCodeSvg } from "@/ui/view/qr-code";

// Código QR de una página pública: `/{handle}/qr.svg`. Lo muestran el panel y la
// ventana de compartir. Solo para páginas que existen y se publican; apunta a la
// URL canónica, sin marcas (se cuenta como una visita directa). Con `?descargar`
// baja como archivo. Se cachea con la etiqueta del perfil (cache-policy.ts).
export const GET: APIRoute = async ({ params, url }) => {
  // Valida el handle (incluida la página oficial, que es un handle reservado).
  const page = await getPublicPage({ pages: publicPages() })(params["handle"]);
  if (!page.ok) return new Response(null, { status: 404 });

  const { handle } = page.value;
  const target = new URL(`/${handle}`, url.origin).href;
  const svg = qrCodeSvg(target, `Código QR de ${target}`);
  const filename = `plektia-${handle}-qr.svg`;
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Abierto solo, el SVG no puede correr nada ni cargar nada.
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": url.searchParams.has("descargar")
        ? `attachment; filename="${filename}"`
        : "inline",
    },
  });
};
