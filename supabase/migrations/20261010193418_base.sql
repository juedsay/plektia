-- Base de Plektia.
--
-- Esquema `private`: datos internos (allowlist de invitados, auditoría) que nunca
-- deben ser alcanzables desde la API pública. No está en `api.schemas` de
-- config.toml y, además, se le quitan los privilegios a los roles de la API.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

-- Las tablas y funciones que se creen después en `private` tampoco heredan
-- privilegios para esos roles.
alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke all on functions from public, anon, authenticated;
alter default privileges in schema private revoke all on sequences from public, anon, authenticated;
