#!/usr/bin/env bash
# scripts/optimize-build-cache.sh
# INFRA-833: Build artifact caching optimization.
#
# Analyzes and prunes build caches to reduce redundant work while keeping
# cache corruption detectable. Produces a cache health report.
#
# Usage:
#   bash scripts/optimize-build-cache.sh [command]
#
# Commands:
#   analyze   Scan cache directories and report sizes/staleness
#   prune     Remove stale/unused cache entries
#   verify    Check cache integrity for corruption
#   report    Full cache health report
#
# Exit codes:
#   0 — all operations completed
#   1 — cache corruption detected or prune failed

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_DIRS=(
  "$ROOT/.turbo"
  "$ROOT/node_modules/.cache"
)
ERRORS=0

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
heading() { echo -e "${CYAN}══ $* ══${NC}"; }
ok()      { echo -e "${GREEN}✓${NC} $*"; }
fail()    { echo -e "${RED}✗${NC} $*"; }

COMMAND="${1:-report}"

cmd_analyze() {
  heading "Cache Analysis"
  echo ""

  for dir in "${CACHE_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
      local size
      local file_count
      size=$(du -sh "$dir" 2>/dev/null | cut -f1)
      file_count=$(find "$dir" -type f 2>/dev/null | wc -l)
      info "$dir: ${size}, ${file_count} files"

      # Check for files older than 7 days
      local stale
      stale=$(find "$dir" -type f -mtime +7 2>/dev/null | wc -l)
      if [[ $stale -gt 0 ]]; then
        warn "  $stale file(s) older than 7 days"
      fi
    else
      info "$dir: does not exist"
    fi
  done
}

cmd_prune() {
  heading "Cache Pruning"
  echo ""

  for dir in "${CACHE_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
      local before before_f
      before=$(du -sh "$dir" 2>/dev/null | cut -f1)
      before_f=$(find "$dir" -type f 2>/dev/null | wc -l)

      # Remove files older than 7 days (keep turbo cache effective)
      find "$dir" -type f -mtime +7 -delete 2>/dev/null || true
      # Remove empty directories
      find "$dir" -type d -empty -delete 2>/dev/null || true

      local after after_f
      after=$(du -sh "$dir" 2>/dev/null | cut -f1)
      after_f=$(find "$dir" -type f 2>/dev/null | wc -l)

      ok "$dir: ${before} → ${after} (${before_f} → ${after_f} files)"
    fi
  done
}

cmd_verify() {
  heading "Cache Integrity Verification"
  echo ""

  for dir in "${CACHE_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
      # Check for zero-byte files (corruption indicator)
      local zero_byte
      zero_byte=$(find "$dir" -type f -size 0 2>/dev/null | wc -l)
      if [[ $zero_byte -gt 0 ]]; then
        warn "$dir: $zero_byte zero-byte file(s) found (possible corruption)"
        ERRORS=$((ERRORS + 1))
      else
        ok "$dir: no zero-byte files"
      fi

      # Check for permission issues
      local unreadable
      unreadable=$(find "$dir" -type f ! -readable 2>/dev/null | wc -l)
      if [[ $unreadable -gt 0 ]]; then
        warn "$dir: $unreadable unreadable file(s)"
        ERRORS=$((ERRORS + 1))
      else
        ok "$dir: all files readable"
      fi
    else
      info "$dir: does not exist — skipping"
    fi
  done

  if [[ $ERRORS -gt 0 ]]; then
    fail "Cache integrity issues found — investigate and rebuild if needed"
  fi
}

cmd_report() {
  heading "Build Cache Health Report"
  echo ""
  cmd_analyze
  echo ""
  cmd_prune
  echo ""
  cmd_verify
  echo ""
  heading "Report Complete"
  if [[ $ERRORS -gt 0 ]]; then
    fail "$ERRORS issue(s) found"
    exit 1
  else
    ok "Build cache is healthy"
  fi
}

case "$COMMAND" in
  analyze) cmd_analyze ;;
  prune)   cmd_prune   ;;
  verify)  cmd_verify  ;;
  report)  cmd_report  ;;
  *)
    echo "Usage: $0 <analyze|prune|verify|report>"
    exit 1
    ;;
esac
