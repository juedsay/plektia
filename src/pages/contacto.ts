import type { APIRoute } from "astro";

// La página pasó a /contact (rutas propias en inglés). La ruta vieja redirige
// para no romper links ya compartidos; 308 conserva el método, así un
// formulario viejo que todavía apunte acá también llega bien.
export const ALL: APIRoute = () =>
  new Response(null, { status: 308, headers: { Location: "/contact" } });
