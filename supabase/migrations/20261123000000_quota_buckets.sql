-- Cuota de YouTube por fondos (revisión de la ingesta). Antes había un solo
-- fondo diario de 8.000 unidades para todo: "Comprobar ahora" (una vez por
-- minuto por cuenta, sin tope diario) podía gastarlo entero y dejar sin en vivo
-- ni destacado a todas las páginas hasta la medianoche del Pacífico.
--
-- Ahora cada llamada descuenta, todo o nada, de varios fondos a la vez: el
-- total del día, el del trabajo (en vivo, destacado, "Comprobar ahora") y, para
-- "Comprobar ahora", el de cada cuenta. Los topes los decide la app
-- (src/composition/live.ts); acá solo se cuentan.
--
-- Y si Google contesta que la cuota se agotó (la key se usó en otro lado, por
-- ejemplo), el total del día se da por gastado: las llamadas siguientes cortan
-- antes de ir a Google.

-- Los nombres de fondo: proveedor y, opcionalmente, trabajo y cuenta.
alter table private.quota_usage
  add constraint quota_usage_provider_name check (provider ~ '^[a-z]+(:[a-z-]+)?(:[0-9a-f-]{36})?$');

drop function public.ingest_consume_quota(text, integer, integer);

-- Descuenta `p_units` de cada fondo si en todos entra; `false` (sin descontar
-- nada) si alguno pasaría su tope. Los fondos se bloquean en orden, así dos
-- llamadas a la vez nunca se cruzan.
create function public.ingest_consume_quota_from(
  p_buckets text[], p_limits integer[], p_units integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'America/Los_Angeles')::date;
  v_over boolean;
begin
  if p_units <= 0
    or cardinality(p_buckets) = 0
    or cardinality(p_buckets) is distinct from cardinality(p_limits)
    or exists (select 1 from unnest(p_limits) l where l is null or l < p_units) then
    return false;
  end if;

  insert into private.quota_usage (provider, day, units)
  select b, v_day, 0 from unnest(p_buckets) b
  on conflict (provider, day) do nothing;

  perform 1 from private.quota_usage q
  where q.day = v_day and q.provider = any (p_buckets)
  order by q.provider
  for update;

  select exists (
    select 1
    from unnest(p_buckets, p_limits) as t(bucket, daily_limit)
    join private.quota_usage q on q.provider = t.bucket and q.day = v_day
    where q.units + p_units > t.daily_limit
  ) into v_over;
  if v_over then
    return false;
  end if;

  update private.quota_usage q set units = q.units + p_units
  where q.day = v_day and q.provider = any (p_buckets);
  return true;
end;
$$;

-- Google dijo que no hay más cuota hoy: el fondo queda en su tope.
create function public.ingest_exhaust_quota(p_bucket text, p_limit integer)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.quota_usage as q (provider, day, units)
  values (p_bucket, (now() at time zone 'America/Los_Angeles')::date, greatest(p_limit, 0))
  on conflict (provider, day) do update set units = greatest(q.units, excluded.units);
$$;

revoke all on function public.ingest_consume_quota_from(text[], integer[], integer),
  public.ingest_exhaust_quota(text, integer) from public, anon, authenticated;
grant execute on function public.ingest_consume_quota_from(text[], integer[], integer),
  public.ingest_exhaust_quota(text, integer) to service_role;
