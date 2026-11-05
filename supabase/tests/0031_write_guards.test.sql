-- Barrido de revocación (auditoría de seguridad): toda ruta de escritura frena
-- a una cuenta dada de baja y a un token de una app de IA. Este test falla si
-- una política o una función nueva se olvida del control.
--
-- - Políticas de escritura (insert, update, delete) en public y storage: tienen
--   que mirar `disabled` y `client_id`.
-- - Funciones `security definer` que un usuario con sesión puede ejecutar (se
--   saltean la RLS): tienen que pasar por un control (`panel_caller`,
--   `mcp_caller`, `caller_is_owner`) o mirar `disabled`. Las de solo lectura que
--   son el control mismo van en la lista de abajo.
-- - Las `security invoker` escriben con la RLS de quien llama: las cubren las
--   políticas.
begin;
create extension if not exists pgtap with schema extensions;

select plan(2);

select is_empty(
  $$ select schemaname || '.' || tablename || ': ' || policyname
     from pg_policies
     where cmd <> 'SELECT'
       and schemaname in ('public', 'storage')
       and not (
         (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'disabled'
         and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'client_id'
       ) $$,
  'toda política de escritura frena a una cuenta dada de baja y a un token de app');

select is_empty(
  $$ select n.nspname || '.' || p.proname
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and p.prosecdef
       and has_function_privilege('authenticated', p.oid, 'execute')
       and p.proname not in (
         -- El control mismo de las lecturas del dueño (solo lee).
         'owner_read_allowed'
       )
       and pg_get_functiondef(p.oid) !~ '(panel_caller|mcp_caller|caller_is_owner|disabled)' $$,
  'toda función security definer que un usuario puede ejecutar pasa por un control');

select * from finish();
rollback;
