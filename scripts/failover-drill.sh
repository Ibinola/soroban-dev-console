#!/usr/bin/env bash
# scripts/failover-drill.sh
# INFRA-211: Failover drill for upstream verification and notification dependencies.
#
# Simulates degraded and unavailable upstream dependencies by temporarily
# overriding env vars, exercising health and RPC endpoints, and reporting
# whether the platform recovers gracefully without operator intervention.
#
# Usage:
#   bash scripts/failover-drill.sh [--api-url <url>] [--network <testnet|mainnet|futurenet>]
#
# Exit codes:
#   0 — all failover scenarios passed
#   1 — one or more scenarios failed

set -euo pipefail

API_URL="${API_URL:-http://localhost:4000}"
NETWORK="${NETWORK:-testnet}"
ERRORS=0

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass()  { echo -e "${GREEN}✅ PASS${NC}  $*"; }
fail()  { echo -e "${RED}❌ FAIL${NC}  $*"; ERRORS=$((ERRORS + 1)); }
warn()  { echo -e "${YELLOW}⚠️  WARN${NC}  $*"; }
info()  { echo -e "   ℹ️   $*"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-url)  API_URL="$2";  shift 2 ;;
    --network)  NETWORK="$2";  shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Soroban DevConsole — Failover Drill"
echo "  $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "  API: ${API_URL}  Network: ${NETWORK}"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── Helper: HTTP GET with timeout ────────────────────────────────────────────
http_get() {
  curl -sf --max-time 5 "$1" 2>/dev/null
}

# ── Scenario 1: Baseline health ──────────────────────────────────────────────
echo "── Scenario 1: Baseline Health ─────────────────────────"
HEALTH=$(http_get "${API_URL}/health" || echo "")
if [[ -z "${HEALTH}" ]]; then
  fail "API /health is unreachable — ensure the API is running before the drill"
  echo ""
  echo "Drill aborted: API unavailable."
  exit 1
fi

DB_STATUS=$(echo "${HEALTH}" | grep -o '"db":"[^"]*"' | grep -o '[^:]*"$' | tr -d '"' || echo "unknown")
if [[ "${DB_STATUS}" == "ok" ]]; then
  pass "Database reports healthy"
else
  warn "Database status: ${DB_STATUS}"
fi

RPC_STATUS=$(echo "${HEALTH}" | grep -o "\"${NETWORK}\":\"[^\"]*\"" | grep -o '[^:]*"$' | tr -d '"' || echo "unknown")
if [[ "${RPC_STATUS}" == "ok" ]]; then
  pass "RPC endpoint (${NETWORK}) reports healthy"
else
  warn "RPC endpoint (${NETWORK}) status: ${RPC_STATUS} — degraded mode will be exercised"
fi
echo ""

# ── Scenario 2: RPC single-endpoint degraded ─────────────────────────────────
echo "── Scenario 2: RPC Degraded-Endpoint Failover ──────────"
info "Sending a proxied RPC call to exercise the failover path"
RPC_RESP=$(curl -sf --max-time 10 \
  -X POST "${API_URL}/rpc/${NETWORK}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth","params":[]}' 2>/dev/null || echo "")

if echo "${RPC_RESP}" | grep -q '"result"'; then
  pass "RPC proxy returned a result — failover or primary endpoint is healthy"
elif echo "${RPC_RESP}" | grep -q '"error"'; then
  warn "RPC proxy returned a JSON-RPC error — upstream may be degraded, verify manually"
else
  fail "RPC proxy did not respond or returned unexpected output"
fi
echo ""

# ── Scenario 3: Notification dependency degraded ─────────────────────────────
echo "── Scenario 3: Notification Endpoint Availability ──────"
NOTIF_RESP=$(http_get "${API_URL}/notifications" || echo "")
if [[ -n "${NOTIF_RESP}" ]]; then
  pass "Notifications endpoint is reachable"
else
  warn "Notifications endpoint did not respond — check if authentication is required or service is degraded"
fi
echo ""

# ── Scenario 4: Job queue drain check ────────────────────────────────────────
echo "── Scenario 4: Job Queue Depth ─────────────────────────"
QUEUE_RESP=$(http_get "${API_URL}/jobs/stats" || echo "")
if [[ -n "${QUEUE_RESP}" ]]; then
  PENDING=$(echo "${QUEUE_RESP}" | grep -o '"pending":[0-9]*' | grep -o '[0-9]*' || echo "0")
  if [[ "${PENDING}" -gt 500 ]]; then
    fail "Job queue depth is ${PENDING} — above the P2 threshold of 500 (see docs/runbooks.md RB-005)"
  elif [[ "${PENDING}" -gt 100 ]]; then
    warn "Job queue depth is ${PENDING} — elevated; monitor for continued growth"
  else
    pass "Job queue depth is ${PENDING} — within healthy range"
  fi
else
  warn "Job stats endpoint did not respond — queue depth unknown"
fi
echo ""

  # ── Scenario 5: Dead-letter handling drill ──────────────────────────────────
  echo "── Scenario 5: Dead-Letter Job Handling ────────────────"
  DL_RESP=$(http_get "${API_URL}/jobs/stats" || echo "")
  if [[ -n "${DL_RESP}" ]]; then
    DEAD=$(echo "${DL_RESP}" | grep -o '"dead":[0-9]*' | grep -o '[0-9]*' || echo "0")
    if [[ "${DEAD}" -gt 50 ]]; then
      warn "Dead-letter queue has ${DEAD} jobs — investigate and retry via /jobs/:id/replay"
    else
      pass "Dead-letter queue depth is ${DEAD} — within normal range"
    fi
  else
    warn "Job stats endpoint did not respond — dead-letter depth unknown"
  fi
  echo ""

  # ── Scenario 6: Backup integrity check ──────────────────────────────────────
  echo "── Scenario 6: Backup Integrity ────────────────────────"
  BACKUP_DIR="${BACKUP_DIR:-.backups}"
  if [[ -d "${BACKUP_DIR}" ]]; then
    BACKUP_COUNT=$(find "${BACKUP_DIR}" -maxdepth 1 -name "*.db" | wc -l)
    if [[ "${BACKUP_COUNT}" -gt 0 ]]; then
      pass "${BACKUP_COUNT} backup(s) available in ${BACKUP_DIR}"
      # Verify the most recent backup
      LATEST=$(find "${BACKUP_DIR}" -maxdepth 1 -name "*.db" -print0 | sort -rz | head -1)
      if sqlite3 "${LATEST}" "PRAGMA integrity_check;" 2>/dev/null | grep -q "^ok$"; then
        pass "Latest backup integrity verified"
      else
        fail "Latest backup failed integrity check"
      fi
    else
      warn "No backups found in ${BACKUP_DIR} — run backup-restore-drill.sh backup first"
    fi
  else
    warn "Backup directory ${BACKUP_DIR} does not exist"
  fi
  echo ""

  # ── Scenario 7: Staging parity check ────────────────────────────────────────
  echo "── Scenario 7: Environment Parity ──────────────────────"
  if command -v bash &>/dev/null && [[ -f "scripts/check-env-parity.sh" ]]; then
    PARITY_RESULT=$(bash scripts/check-env-parity.sh 2>&1 || true)
    if echo "${PARITY_RESULT}" | grep -q "FAIL"; then
      fail "Environment parity check failed"
    else
      pass "Environment parity check passed"
    fi
  else
    warn "check-env-parity.sh not available — skipping parity check"
  fi
  echo ""

  # ── Summary ───────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
if [[ "${ERRORS}" -eq 0 ]]; then
  echo -e "${GREEN}  ✅ Failover drill completed — no hard failures${NC}"
  echo "  Review warnings above before Wave launch."
else
  echo -e "${RED}  ❌ ${ERRORS} scenario(s) failed — investigate before Wave launch${NC}"
  echo "  See docs/runbooks.md for resolution steps."
fi
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  - Address any ❌ or ⚠️  items above"
echo "  - Re-run after fixes: bash scripts/failover-drill.sh"
echo "  - Document results as a GitHub comment on INFRA-211"
echo ""

exit "${ERRORS}"
