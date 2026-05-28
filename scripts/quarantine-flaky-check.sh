#!/usr/bin/env bash
# DEVOPS-213: Flaky-check quarantine helper.
#
# Detects, records, and reports flaky CI jobs without removing required protections.
#
# Usage:
#   ./scripts/quarantine-flaky-check.sh <command> [options]
#
# Commands:
#   detect  <job-name> <run-count>   Re-run a job N times and flag if it fails intermittently
#   add     <job-name> <reason>      Manually quarantine a known-flaky job
#   remove  <job-name>               Graduate a job out of quarantine
#   list                             List all currently quarantined jobs
#   report                           Print a summary report (used by CI)
#
# Quarantine state is stored in .github/flaky-quarantine.json

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
heading() { echo -e "${CYAN}$*${NC}"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QUARANTINE_FILE="$ROOT/.github/flaky-quarantine.json"

# ── Ensure quarantine file exists ─────────────────────────────────────────────
init_file() {
  if [[ ! -f "$QUARANTINE_FILE" ]]; then
    echo '{"quarantined": [], "graduated": []}' > "$QUARANTINE_FILE"
    info "Created $QUARANTINE_FILE"
  fi
}

# ── Helpers ───────────────────────────────────────────────────────────────────
timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

is_quarantined() {
  local job="$1"
  python3 -c "
import json, sys
data = json.load(open('$QUARANTINE_FILE'))
names = [e['job'] for e in data.get('quarantined', [])]
sys.exit(0 if '$job' in names else 1)
" 2>/dev/null
}

# ── Commands ──────────────────────────────────────────────────────────────────

cmd_detect() {
  local job_name="${1:-}"
  local run_count="${2:-5}"

  if [[ -z "$job_name" ]]; then
    error "Usage: $0 detect <job-name> [run-count]"
    exit 1
  fi

  heading "Flaky detection: $job_name (${run_count} runs)"
  echo ""

  local pass=0 fail=0

  for i in $(seq 1 "$run_count"); do
    echo -n "  Run $i/$run_count ... "
    # In CI this would invoke the actual test command passed via env var TEST_CMD.
    # Here we simulate by checking if TEST_CMD is set and running it.
    if [[ -n "${TEST_CMD:-}" ]]; then
      if eval "$TEST_CMD" > /tmp/flaky-run-"$i".log 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        pass=$((pass + 1))
      else
        echo -e "${RED}FAIL${NC}"
        fail=$((fail + 1))
      fi
    else
      warn "TEST_CMD not set — skipping actual execution (dry detection mode)"
      break
    fi
  done

  echo ""
  info "Results: $pass passed, $fail failed out of $run_count runs"

  if [[ $fail -gt 0 && $pass -gt 0 ]]; then
    warn "Job '$job_name' is FLAKY ($fail/$run_count failures)"
    cmd_add "$job_name" "auto-detected: $fail/$run_count failures on $(timestamp)"
    exit 2  # non-zero but distinct from hard failure
  elif [[ $fail -eq "$run_count" ]]; then
    error "Job '$job_name' CONSISTENTLY FAILS — this is not flakiness, fix the job."
    exit 1
  else
    info "Job '$job_name' appears stable."
  fi
}

cmd_add() {
  local job_name="${1:-}"
  local reason="${2:-manually quarantined}"

  if [[ -z "$job_name" ]]; then
    error "Usage: $0 add <job-name> <reason>"
    exit 1
  fi

  init_file

  if is_quarantined "$job_name"; then
    warn "'$job_name' is already quarantined."
    return
  fi

  python3 - <<PYEOF
import json
data = json.load(open('$QUARANTINE_FILE'))
data['quarantined'].append({
    'job': '$job_name',
    'reason': '$reason',
    'quarantined_at': '$(timestamp)',
    'review_by': '$(date -u -d "+14 days" +"%Y-%m-%d" 2>/dev/null || date -u -v+14d +"%Y-%m-%d" 2>/dev/null || echo "review-needed")'
})
json.dump(data, open('$QUARANTINE_FILE', 'w'), indent=2)
PYEOF

  warn "Quarantined: $job_name — $reason"
  warn "This job will still run in CI but failures will be annotated, not blocking."
  warn "Review by: $(python3 -c "import json; q=[e for e in json.load(open('$QUARANTINE_FILE'))['quarantined'] if e['job']=='$job_name']; print(q[-1]['review_by'] if q else 'unknown')")"
}

cmd_remove() {
  local job_name="${1:-}"

  if [[ -z "$job_name" ]]; then
    error "Usage: $0 remove <job-name>"
    exit 1
  fi

  init_file

  if ! is_quarantined "$job_name"; then
    warn "'$job_name' is not currently quarantined."
    return
  fi

  python3 - <<PYEOF
import json
data = json.load(open('$QUARANTINE_FILE'))
entry = next((e for e in data['quarantined'] if e['job'] == '$job_name'), None)
if entry:
    data['quarantined'] = [e for e in data['quarantined'] if e['job'] != '$job_name']
    entry['graduated_at'] = '$(timestamp)'
    data['graduated'].append(entry)
json.dump(data, open('$QUARANTINE_FILE', 'w'), indent=2)
PYEOF

  info "Graduated '$job_name' out of quarantine."
}

cmd_list() {
  init_file
  heading "Currently quarantined jobs:"
  echo ""
  python3 - <<PYEOF
import json
data = json.load(open('$QUARANTINE_FILE'))
items = data.get('quarantined', [])
if not items:
    print('  (none)')
else:
    for e in items:
        print(f"  • {e['job']}")
        print(f"    Reason:      {e['reason']}")
        print(f"    Since:       {e['quarantined_at']}")
        print(f"    Review by:   {e['review_by']}")
        print()
PYEOF
}

cmd_report() {
  init_file
  python3 - <<PYEOF
import json, sys
data = json.load(open('$QUARANTINE_FILE'))
items = data.get('quarantined', [])
if not items:
    print('✅ No quarantined checks.')
    sys.exit(0)

print(f'⚠️  {len(items)} quarantined check(s):')
for e in items:
    print(f"  • {e['job']} (since {e['quarantined_at']}, review by {e['review_by']})")
    print(f"    {e['reason']}")

# Exit non-zero if any entry is past its review date
from datetime import datetime, timezone
today = datetime.now(timezone.utc).date()
overdue = [e for e in items if e.get('review_by', '') < str(today)]
if overdue:
    print()
    print(f'❌ {len(overdue)} quarantine(s) are OVERDUE for review:')
    for e in overdue:
        print(f"  • {e['job']} — review was due {e['review_by']}")
    sys.exit(1)
PYEOF
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
COMMAND="${1:-}"
shift || true

case "$COMMAND" in
  detect) cmd_detect "$@" ;;
  add)    cmd_add    "$@" ;;
  remove) cmd_remove "$@" ;;
  list)   cmd_list        ;;
  report) cmd_report      ;;
  *)
    echo "Usage: $0 <detect|add|remove|list|report> [args]"
    echo ""
    echo "Commands:"
    echo "  detect <job> [runs]   Re-run a job N times and auto-quarantine if flaky"
    echo "  add    <job> <reason> Manually quarantine a job"
    echo "  remove <job>          Graduate a job out of quarantine"
    echo "  list                  List quarantined jobs"
    echo "  report                Print CI-friendly summary (exits 1 if overdue)"
    exit 1
    ;;
esac
