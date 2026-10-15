#!/usr/bin/env bash
# Guarda (o renueva) el token de Supabase que usa la CI para aplicar migraciones.
# Lo valida antes de guardarlo: formato exacto que exige la CLI y una llamada a la
# API solo con ese token (sin caer en tu sesión de la CLI).
#
#   & "C:\Program Files\Git\bin\bash.exe" scripts/renovar-token-supabase.sh
set -euo pipefail

GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RED=$'\e[31m'; BOLD=$'\e[1m'; RESET=$'\e[0m'
say() { printf '  %s\n' "$1"; }
ok() { printf '  %s✓ %s%s\n' "$GREEN" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }
fail() { printf '  %s✗ %s%s\n' "$RED" "$1" "$RESET"; exit 1; }

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)
REF=$(gh variable get SUPABASE_PROJECT_REF --env production 2>/dev/null || true)
[[ -n "$REPO" && -n "$REF" ]] || fail "No encuentro el repo o SUPABASE_PROJECT_REF (¿gh auth login?)."

printf '\n%sToken de Supabase para la CI · proyecto %s%s\n\n' "$BOLD" "$REF" "$RESET"
say "En https://supabase.com/dashboard/account/tokens → Generate new token:"
say "  Nombre: plektia-ci · Expires in: 90 días (máximo 1 año)"
say "  Resource access: Project → juedsay → plektia"
say "  Project → Project Settings: Read"
say "  Database → Migrations: Read-write · Connection Pooling: Read · todo lo demás: None"
say "Copialo con el ícono de copiar de Supabase. Para pegar: clic derecho o Shift+Insert."
echo
printf '  %sPegá el token (no se ve):%s ' "$BOLD" "$RESET"
read -rs raw
printf '\n'

# Sin espacios ni retornos de carro (Enter en algunas terminales de Windows deja un \r).
token=$(printf '%s' "$raw" | tr -d '[:space:]')
unset raw
[[ -n "$token" ]] || fail "No llegó nada: el pegado no funcionó. Probá con clic derecho."
# El mismo formato que valida la CLI de Supabase.
if [[ ! "$token" =~ ^sbp_(oauth_|v0_)?[a-f0-9]{40}$ ]]; then
  fail "El formato no es el de un token de Supabase (sbp_ + 40 caracteres; llegaron ${#token}, empieza con '${token:0:4}')."
fi
ok "Formato válido (${#token} caracteres)"

status=$(curl -s -o /dev/null -w '%{http_code}' "https://api.supabase.com/v1/projects/${REF}" \
  -H "Authorization: Bearer ${token}")
case "$status" in
  200) ok "Supabase acepta el token para el proyecto" ;;
  401) fail "Supabase rechaza el token (401): copiá uno nuevo." ;;
  403) fail "El token no alcanza el proyecto (403): revisá Resource access y Project Settings: Read." ;;
  *) fail "Respuesta inesperada de Supabase: HTTP ${status}." ;;
esac

printf '%s' "$token" | gh secret set SUPABASE_ACCESS_TOKEN --env production --repo "$REPO"
unset token
ok "Guardado en GitHub (entorno production)"
warn "Borrá el token plektia-ci anterior en https://supabase.com/dashboard/account/tokens"
