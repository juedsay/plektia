#!/usr/bin/env bash
# Renueva un token de la CI (tarea 9c): guía la creación del token nuevo con los
# mismos permisos, lo verifica solo con ese token (sin caer en tu sesión de la
# CLI), lo guarda en GitHub y actualiza su fecha de vencimiento, que es la que
# mira el workflow semanal `tokens.yml`.
#
#   & "C:\Program Files\Git\bin\bash.exe" scripts/renovar-token.sh supabase
#   & "C:\Program Files\Git\bin\bash.exe" scripts/renovar-token.sh cloudflare
set -euo pipefail

GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RED=$'\e[31m'; BOLD=$'\e[1m'; RESET=$'\e[0m'
say() { printf '  %s\n' "$1"; }
ok() { printf '  %s✓ %s%s\n' "$GREEN" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }
fail() { printf '  %s✗ %s%s\n' "$RED" "$1" "$RESET"; exit 1; }

PROVIDER="${1:-}"
[[ "$PROVIDER" == "supabase" || "$PROVIDER" == "cloudflare" ]] ||
  fail "Uso: bash scripts/renovar-token.sh supabase|cloudflare"

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)
[[ -n "$REPO" ]] || fail "No encuentro el repo (¿gh auth login?)."

# read_token VAR: lee un token sin mostrarlo, sin espacios ni \r (Enter en
# algunas terminales de Windows deja uno).
read_token() {
  local raw
  printf '  %sPegá el token (no se ve):%s ' "$BOLD" "$RESET"
  read -rs raw
  printf '\n'
  printf -v "$1" '%s' "$(printf '%s' "$raw" | tr -d '[:space:]')"
  [[ -n "${!1}" ]] || fail "No llegó nada: el pegado no funcionó. Probá con clic derecho."
}

# ask_date VAR DEFAULT: fecha de vencimiento AAAA-MM-DD, con valor propuesto.
ask_date() {
  local answer
  printf '  %sFecha de vencimiento que muestra el panel [%s]:%s ' "$BOLD" "$2" "$RESET"
  read -r answer
  answer=$(printf '%s' "${answer:-$2}" | tr -d '[:space:]')
  [[ "$answer" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || fail "La fecha tiene que ser AAAA-MM-DD."
  printf -v "$1" '%s' "$answer"
}

if [[ "$PROVIDER" == "supabase" ]]; then
  REF=$(gh variable get SUPABASE_PROJECT_REF --env production 2>/dev/null || true)
  [[ -n "$REF" ]] || fail "No encuentro SUPABASE_PROJECT_REF en el entorno production."

  printf '\n%sToken de Supabase para la CI · proyecto %s%s\n\n' "$BOLD" "$REF" "$RESET"
  say "En https://supabase.com/dashboard/account/tokens → Generate new token:"
  say "  Nombre: plektia-ci · Expires in: 90 días (máximo 1 año)"
  say "  Resource access: Project → juedsay → plektia"
  say "  Project → Project Settings: Read"
  say "  Database → Migrations: Read-write · Connection Pooling: Read · todo lo demás: None"
  say "Copialo con el ícono de copiar de Supabase. Para pegar: clic derecho o Shift+Insert."
  echo
  read_token token
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

  ask_date expires_on "$(date -u -d '+90 days' +%F)"
  printf '%s' "$token" | gh secret set SUPABASE_ACCESS_TOKEN --env production --repo "$REPO"
  unset token
  gh variable set SUPABASE_TOKEN_EXPIRES_ON --body "$expires_on" --repo "$REPO"
  ok "Guardado en GitHub (entorno production) · vence el $expires_on"
  warn "Borrá el token plektia-ci anterior en https://supabase.com/dashboard/account/tokens"
else
  printf '\n%sToken de Cloudflare para la CI (deploy del Worker)%s\n\n' "$BOLD" "$RESET"
  say "En https://dash.cloudflare.com/?to=/:account/api-tokens → Create Token → Create Custom Token:"
  say "  Nombre: plektia-deploy-ci"
  say "  Permisos: Workers → Editor, con alcance solo al Worker 'app'"
  say "  (si el panel no ofrece alcance por Worker: Workers → Editor para la cuenta)"
  say "  TTL: hasta un año como máximo."
  say "Continue to summary → Create Token → copiá el token (se muestra una sola vez)."
  echo
  printf '  %sAccount ID (columna derecha de Workers & Pages):%s ' "$BOLD" "$RESET"
  read -r account_id
  account_id=$(printf '%s' "$account_id" | tr -d '[:space:]')
  [[ "$account_id" =~ ^[a-f0-9]{32}$ ]] || fail "El Account ID son 32 caracteres hexadecimales."
  read_token token

  response=$(curl -s "https://api.cloudflare.com/client/v4/accounts/${account_id}/tokens/verify" \
    -H "Authorization: Bearer ${token}")
  printf '%s' "$response" | grep -q '"status":"active"' ||
    fail "Cloudflare no confirmó el token. Revisá que lo copiaste entero y que es de esta cuenta."
  ok "Cloudflare confirma el token activo"

  # Si el token tiene TTL, Cloudflare informa su vencimiento: se propone ese.
  reported=$(printf '%s' "$response" | grep -o '"expires_on":"[0-9-]*' | cut -d'"' -f4 || true)
  ask_date expires_on "${reported:-$(date -u -d '+1 year' +%F)}"
  printf '%s' "$token" | gh secret set CLOUDFLARE_API_TOKEN --env production --repo "$REPO"
  unset token
  gh variable set CLOUDFLARE_TOKEN_EXPIRES_ON --body "$expires_on" --repo "$REPO"
  ok "Guardado en GitHub (entorno production) · vence el $expires_on"
  warn "Borrá el token plektia-deploy-ci anterior en el panel de Cloudflare"
fi

say "Si había un issue abierto de 'Renovar el token', ya lo podés cerrar."
