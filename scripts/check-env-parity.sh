#!/usr/bin/env bash
# scripts/check-env-parity.sh
# DEVOPS-215: Environment parity check for Wave launches.
#
# Verifies that local, staging, and production-like environments are aligned:
#   - Required env vars are present
#   - WEB_ORIGIN and NEXT_PUBLIC_API_URL are consistent
#   - Port values match the canonical runtime-defaults.ts
#   - No localhost values in non-local RUNTIME_MODE
#   - At least one RPC endpoint is configured
#
# Usage:
#   bash scripts/check-env-parity.sh [--api-env <path>] [--web-env <path>]
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
API_ENV="${API_ENV:-apps/api/.env}"
WEB_ENV="${WEB_ENV:-apps/web/.env.local}"
ERRORS=0
WARNINGS=0

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass()  { echo -e "${GREEN}✅ PASS${NC}  $*"; }
fail()  { echo -e "${RED}❌ FAIL${NC}  $*"; ERRORS=$((ERRORS + 1)); }
warn()  { echo -e "${YELLOW}⚠️  WARN${NC}  $*"; WARNINGS=$((WARNINGS + 1)); }
info()  { echo -e "   ℹ️   $*"; }

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-env) API_ENV="$2"; shift 2 ;;
    --web-env) WEB_ENV="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Soroban DevConsole — Environment Parity Check"
echo "  $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── Helper: read a value from an env file ─────────────────────────────────────
get_env_val() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "${file}" 2>/dev/null | head -1 | sed 's/^[^=]*=//;s/^"//;s/"$//' || true
}

# ── Helper: check a required var is set ───────────────────────────────────────
require_var() {
  local file="$1"
  local key="$2"
  local val
  val=$(get_env_val "${file}" "${key}")
  if [[ -z "${val}" ]]; then
    fail "${key} is not set in ${file}"
  else
    pass "${key} is set in ${file}"
  fi
}

# ── 1. Env file existence ─────────────────────────────────────────────────────
echo "── 1. Env File Existence ────────────────────────────────"
if [[ -f "${API_ENV}" ]]; then
  pass "API env file found: ${API_ENV}"
else
  fail "API env file not found: ${API_ENV}"
  info "Copy apps/api/.env.example to ${API_ENV} and fill in values"
fi

if [[ -f "${WEB_ENV}" ]]; then
  pass "Web env file found: ${WEB_ENV}"
else
  warn "Web env file not found: ${WEB_ENV}"
  info "Copy apps/web/.env.example to ${WEB_ENV} and fill in values"
fi
echo ""

# ── 2. Required API variables ─────────────────────────────────────────────────
echo "── 2. Required API Variables ────────────────────────────"
if [[ -f "${API_ENV}" ]]; then
  require_var "${API_ENV}" "PORT"
  require_var "${API_ENV}" "WEB_ORIGIN"
  require_var "${API_ENV}" "DATABASE_URL"
  require_var "${API_ENV}" "RUNTIME_MODE"

  # At least one RPC endpoint
  TESTNET_URL=$(get_env_val "${API_ENV}" "SOROBAN_RPC_TESTNET_URL")
  MAINNET_URL=$(get_env_val "${API_ENV}" "SOROBAN_RPC_MAINNET_URL")
  FUTURENET_URL=$(get_env_val "${API_ENV}" "SOROBAN_RPC_FUTURENET_URL")
  LOCAL_URL=$(get_env_val "${API_ENV}" "SOROBAN_RPC_LOCAL_URL")

  if [[ -z "${TESTNET_URL}" && -z "${MAINNET_URL}" && -z "${FUTURENET_URL}" && -z "${LOCAL_URL}" ]]; then
    fail "No Soroban RPC endpoint configured in ${API_ENV}"
    info "Set at least one of: SOROBAN_RPC_TESTNET_URL, SOROBAN_RPC_MAINNET_URL, SOROBAN_RPC_FUTURENET_URL, SOROBAN_RPC_LOCAL_URL"
  else
    pass "At least one Soroban RPC endpoint is configured"
    [[ -n "${TESTNET_URL}" ]]  && info "testnet:  ${TESTNET_URL}"
    [[ -n "${MAINNET_URL}" ]]  && info "mainnet:  ${MAINNET_URL}"
    [[ -n "${FUTURENET_URL}" ]] && info "futurenet: ${FUTURENET_URL}"
    [[ -n "${LOCAL_URL}" ]]    && info "local:    ${LOCAL_URL}"
  fi
fi
echo ""

# ── 3. Required Web variables ─────────────────────────────────────────────────
echo "── 3. Required Web Variables ────────────────────────────"
if [[ -f "${WEB_ENV}" ]]; then
  require_var "${WEB_ENV}" "NEXT_PUBLIC_API_URL"
  require_var "${WEB_ENV}" "NEXT_PUBLIC_RPC_TESTNET"
  require_var "${WEB_ENV}" "NEXT_PUBLIC_PASSPHRASE_TESTNET"
  require_var "${WEB_ENV}" "NEXT_PUBLIC_PASSPHRASE_MAINNET"
fi
echo ""

# ── 4. Cross-env consistency ──────────────────────────────────────────────────
echo "── 4. Cross-Environment Consistency ────────────────────"
if [[ -f "${API_ENV}" && -f "${WEB_ENV}" ]]; then
  API_PORT=$(get_env_val "${API_ENV}" "PORT")
  WEB_API_URL=$(get_env_val "${WEB_ENV}" "NEXT_PUBLIC_API_URL")
  API_WEB_ORIGIN=$(get_env_val "${API_ENV}" "WEB_ORIGIN")

  # Check that NEXT_PUBLIC_API_URL port matches API PORT
  if [[ -n "${API_PORT}" && -n "${WEB_API_URL}" ]]; then
    URL_PORT=$(echo "${WEB_API_URL}" | grep -oE ':[0-9]+' | tr -d ':' || true)
    if [[ -n "${URL_PORT}" && "${URL_PORT}" != "${API_PORT}" ]]; then
      fail "Port mismatch: API PORT=${API_PORT} but NEXT_PUBLIC_API_URL uses port ${URL_PORT}"
    else
      pass "API port is consistent between API and Web env files"
    fi
  fi

  # Check WEB_ORIGIN matches web app URL pattern
  if [[ -n "${API_WEB_ORIGIN}" && -n "${WEB_API_URL}" ]]; then
    # Extract host from WEB_API_URL to compare with WEB_ORIGIN host
    API_HOST=$(echo "${WEB_API_URL}" | sed 's|https\?://||;s|/.*||;s|:[0-9]*||')
    ORIGIN_HOST=$(echo "${API_WEB_ORIGIN}" | sed 's|https\?://||;s|/.*||;s|:[0-9]*||')
    if [[ "${API_HOST}" != "${ORIGIN_HOST}" ]]; then
      warn "WEB_ORIGIN host (${ORIGIN_HOST}) differs from NEXT_PUBLIC_API_URL host (${API_HOST}) — verify this is intentional"
    else
      pass "WEB_ORIGIN and NEXT_PUBLIC_API_URL are on the same host"
    fi
  fi
fi
echo ""

# ── 5. Port alignment with runtime-defaults.ts ───────────────────────────────
echo "── 5. Port Alignment with runtime-defaults.ts ──────────"
DEFAULTS_FILE="packages/api-contracts/src/runtime-defaults.ts"
if [[ -f "${DEFAULTS_FILE}" ]]; then
  CANONICAL_API_PORT=$(grep -oE 'DEFAULT_API_PORT = [0-9]+' "${DEFAULTS_FILE}" | grep -oE '[0-9]+' || true)
  CANONICAL_WEB_PORT=$(grep -oE 'DEFAULT_WEB_PORT = [0-9]+' "${DEFAULTS_FILE}" | grep -oE '[0-9]+' || true)

  if [[ -n "${CANONICAL_API_PORT}" && -f "${API_ENV}" ]]; then
    ENV_API_PORT=$(get_env_val "${API_ENV}" "PORT")
    if [[ -n "${ENV_API_PORT}" && "${ENV_API_PORT}" != "${CANONICAL_API_PORT}" ]]; then
      fail "API PORT=${ENV_API_PORT} does not match canonical DEFAULT_API_PORT=${CANONICAL_API_PORT}"
    else
      pass "API PORT aligns with runtime-defaults.ts (${CANONICAL_API_PORT})"
    fi
  fi

  if [[ -n "${CANONICAL_WEB_PORT}" && -f "${WEB_ENV}" ]]; then
    WEB_API_URL=$(get_env_val "${WEB_ENV}" "NEXT_PUBLIC_API_URL")
    # We check that the web env doesn't accidentally use the web port for the API URL
    URL_PORT=$(echo "${WEB_API_URL}" | grep -oE ':[0-9]+' | tr -d ':' || true)
    if [[ -n "${URL_PORT}" && "${URL_PORT}" == "${CANONICAL_WEB_PORT}" ]]; then
      warn "NEXT_PUBLIC_API_URL appears to use the web port (${CANONICAL_WEB_PORT}) — expected the API port (${CANONICAL_API_PORT:-?})"
    fi
  fi
else
  warn "runtime-defaults.ts not found at ${DEFAULTS_FILE} — skipping canonical port check"
fi
echo ""

# ── 6. Non-local environment warnings ────────────────────────────────────────
echo "── 6. Non-Local Environment Warnings ───────────────────"
if [[ -f "${API_ENV}" ]]; then
  RUNTIME_MODE=$(get_env_val "${API_ENV}" "RUNTIME_MODE")
  if [[ "${RUNTIME_MODE}" != "local" && "${RUNTIME_MODE}" != "" ]]; then
    info "RUNTIME_MODE=${RUNTIME_MODE} — checking for localhost values..."

    WEB_ORIGIN=$(get_env_val "${API_ENV}" "WEB_ORIGIN")
    if echo "${WEB_ORIGIN}" | grep -q "localhost"; then
      warn "WEB_ORIGIN contains 'localhost' but RUNTIME_MODE=${RUNTIME_MODE}"
    else
      pass "WEB_ORIGIN does not use localhost in ${RUNTIME_MODE} mode"
    fi

    LOCAL_RPC=$(get_env_val "${API_ENV}" "SOROBAN_RPC_LOCAL_URL")
    if [[ -n "${LOCAL_RPC}" ]] && echo "${LOCAL_RPC}" | grep -q "localhost"; then
      warn "SOROBAN_RPC_LOCAL_URL is set to a localhost URL in ${RUNTIME_MODE} mode — ensure this is intentional"
    fi

    # INFRA-209: Wave-critical feature flag parity
    echo ""
    echo "── 6a. Wave Feature Flag Parity ─────────────────────"
    MULTI_OP=$(get_env_val "${API_ENV}" "FEATURE_MULTI_OP")
    if [[ "${MULTI_OP}" == "true" || -z "${MULTI_OP}" ]]; then
      warn "FEATURE_MULTI_OP is enabled in ${RUNTIME_MODE} mode — production default is 'false'; set explicitly if intentional"
    else
      pass "FEATURE_MULTI_OP=false matches production default"
    fi

    for FLAG in FEATURE_SHARING FEATURE_TOKEN_DASHBOARD FEATURE_AUDIT_LOG FEATURE_RPC_GATEWAY; do
      VAL=$(get_env_val "${API_ENV}" "${FLAG}")
      if [[ "${VAL}" == "false" ]]; then
        warn "${FLAG}=false in ${RUNTIME_MODE} mode — staging should match production (true) unless intentionally disabled"
      else
        pass "${FLAG} is enabled"
      fi
    done
  else
    info "RUNTIME_MODE=local — skipping non-local checks"
  fi
fi
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
if [[ "${ERRORS}" -eq 0 && "${WARNINGS}" -eq 0 ]]; then
  echo -e "${GREEN}  ✅ All parity checks passed${NC}"
elif [[ "${ERRORS}" -eq 0 ]]; then
  echo -e "${YELLOW}  ⚠️  ${WARNINGS} warning(s) — review before Wave launch${NC}"
else
  echo -e "${RED}  ❌ ${ERRORS} error(s), ${WARNINGS} warning(s) — fix before Wave launch${NC}"
fi
echo "═══════════════════════════════════════════════════════"
echo ""

exit "${ERRORS}"
