#!/usr/bin/env bash
# Configura Supabase Auth en producción por la API de gestión: URLs, email y
# teléfono desactivados, el hook de invitaciones y los proveedores GitHub y
# Google. Se puede correr las veces que haga falta: cada parte es idempotente.
#
#   & "C:\Program Files\Git\bin\bash.exe" scripts/configurar-auth.sh
set -euo pipefail

GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RED=$'\e[31m'; BOLD=$'\e[1m'; RESET=$'\e[0m'
say() { printf '  %s\n' "$1"; }
ok() { printf '  %s✓ %s%s\n' "$GREEN" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }
fail() { printf '  %s✗ %s%s\n' "$RED" "$1" "$RESET"; exit 1; }
ask() { printf '  %s%s%s ' "$BOLD" "$2" "$RESET"; read -r "$1"; }
ask_secret() { printf '  %s%s%s ' "$BOLD" "$2" "$RESET"; read -rs "$1"; printf '\n'; }

REF=$(gh variable get SUPABASE_PROJECT_REF --env production 2>/dev/null || true)
APP_URL=$(gh variable get PRODUCTION_URL --env production 2>/dev/null || true)
[[ -n "$REF" && -n "$APP_URL" ]] || fail "No encuentro SUPABASE_PROJECT_REF o PRODUCTION_URL en GitHub (¿gh auth login?)."
API="https://api.supabase.com/v1/projects/${REF}/config/auth"
export APP_URL HOOK_URI="pg-functions://postgres/private/before_user_created"

# PATCH de una parte de la configuración. El JSON lo arma Node desde el entorno
# (los secretos no pasan por la línea de comandos); si Supabase la rechaza, se
# muestra su mensaje, que nunca incluye los valores enviados.
apply() {
  local part="$1" label="$2" response status
  response=$(node scripts/wizard-helpers.mjs "auth-config-${part}" |
    curl -sS -X PATCH "$API" -H "Authorization: Bearer ${SETUP_TOKEN}" \
      -H "Content-Type: application/json" --data @- -w '\n%{http_code}')
  status="${response##*$'\n'}"
  if [[ "$status" == "200" ]]; then
    ok "$label"
  else
    printf '  %s✗ %s: HTTP %s%s\n' "$RED" "$label" "$status" "$RESET"
    printf '    Supabase dice: %s\n' "${response%$'\n'*}"
    exit 1
  fi
}

printf '\n%sConfigurar Supabase Auth · proyecto %s%s\n\n' "$BOLD" "$REF" "$RESET"
say "Para pegar: clic derecho o Shift+Insert. Los secretos no se ven al pegarlos."
say "Token: plektia-setup (Project → plektia · Project Settings: Read-write ·"
say "API Keys: Read · Auth Config: Read-write). El endpoint de Auth pide project_admin_write."
echo

# 1. Token: se verifica antes de pedir nada más.
ask_secret SETUP_TOKEN "Pegá el token plektia-setup:"
[[ ${#SETUP_TOKEN} -ge 20 ]] || fail "El token llegó vacío o cortado (${#SETUP_TOKEN} caracteres): copialo de nuevo."
status=$(curl -s -o /dev/null -w '%{http_code}' "$API" -H "Authorization: Bearer ${SETUP_TOKEN}")
case "$status" in
  200) ok "Supabase acepta el token" ;;
  401) fail "Supabase rechaza el token (401): está mal copiado, vencido o borrado. Generá uno nuevo." ;;
  403) fail "El token no tiene permiso (403): revisá los permisos de arriba." ;;
  *) fail "Respuesta inesperada de Supabase: HTTP ${status}." ;;
esac

# 2 y 3. Lo que no necesita credenciales va primero: si algo falla, no se
# gastaron secretos de los proveedores.
apply urls "URLs del sitio y del callback; email y teléfono desactivados"
apply hook "Hook before_user_created (solo entran los invitados)"
echo

# 4. Proveedores.
say "GitHub → Settings → Developer settings → OAuth Apps → Plektia"
say "(si no tenés el secret: 'Generate a new client secret' y borrá el viejo)."
ask GITHUB_CLIENT_ID "Client ID de GitHub:"
ask_secret GITHUB_SECRET "Client secret de GitHub:"
say "Google Cloud (proyecto plektia) → Google Auth Platform → Clientes → Plektia."
ask GOOGLE_CLIENT_ID "ID de cliente de Google:"
ask_secret GOOGLE_SECRET "Secreto de cliente de Google:"
for value in GITHUB_CLIENT_ID GITHUB_SECRET GOOGLE_CLIENT_ID GOOGLE_SECRET; do
  [[ -n "${!value}" ]] || fail "Falta ${value}: volvé a correr el script."
done
export GITHUB_CLIENT_ID GITHUB_SECRET GOOGLE_CLIENT_ID GOOGLE_SECRET
apply providers "Proveedores GitHub y Google"
unset GITHUB_SECRET GOOGLE_SECRET
echo

# 5. Verificación final, leyendo lo que quedó guardado.
say "Verificando lo que quedó en Supabase..."
curl -fsS "$API" -H "Authorization: Bearer ${SETUP_TOKEN}" | node scripts/wizard-helpers.mjs verify-auth ||
  fail "Algún valor no quedó como se esperaba (ver la lista de arriba)."
unset SETUP_TOKEN
echo
ok "Auth configurado."
warn "Borrá el token plektia-setup en https://supabase.com/dashboard/account/tokens"
