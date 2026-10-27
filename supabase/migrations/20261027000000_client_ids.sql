-- Altas idempotentes (SPEC-admin-panel): el panel genera el id (UUID) de lo que
-- crea. Si el mismo pedido llega dos veces (doble clic, reintento de red), el
-- segundo choca con la clave primaria y la app devuelve lo que ya se creó, sin
-- duplicar. Solo se suma `id` a las columnas que se pueden escribir al insertar;
-- la RLS y los triggers de dueño siguen igual.
grant insert (id) on public.sections, public.links, public.pages to authenticated;
