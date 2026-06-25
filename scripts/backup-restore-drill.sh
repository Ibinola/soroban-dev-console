#!/usr/bin/env bash
# DEVOPS-214: Backup and restore drill for operational data.
#
# Creates a timestamped backup of the SQLite database and verifies it can be
# fully restored. Produces actionable output on failure.
#
# Usage:
#   ./scripts/backup-restore-drill.sh [command] [options]
#
# Commands:
#   backup   [--db <path>] [--out <dir>]   Create a backup
#   restore  [--db <path>] <backup-file>   Restore from a backup file
#   drill    [--db <path>] [--out <dir>]   Full backup → restore → verify cycle
#   list     [--out <dir>]                 List available backups
#   prune    [--out <dir>] [--keep <n>]    Remove old backups, keep N most recent
#   verify   [--db <path>]                 Quick integrity check for the active DB
#
# Environment variables (override defaults):
#   DB_PATH   Path to the SQLite database file  (default: apps/api/prisma/dev.db)
#   BACKUP_DIR Directory for backup files        (default: .backups)
#   KEEP_COUNT Number of backups to keep on prune (default: 10)

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
heading() { echo -e "${CYAN}══ $* ══${NC}"; }
ok()      { echo -e "${GREEN}✓${NC} $*"; }
fail()    { echo -e "${RED}✗${NC} $*"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Defaults ──────────────────────────────────────────────────────────────────
DB_PATH="${DB_PATH:-$ROOT/apps/api/prisma/dev.db}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/.backups}"
KEEP_COUNT="${KEEP_COUNT:-10}"

# ── Argument parsing ──────────────────────────────────────────────────────────
COMMAND="${1:-drill}"
shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db)    DB_PATH="$2";    shift 2 ;;
    --out)   BACKUP_DIR="$2"; shift 2 ;;
    --keep)  KEEP_COUNT="$2"; shift 2 ;;
    -*)      error "Unknown option: $1"; exit 1 ;;
    *)       POSITIONAL="${1}"; shift ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
timestamp()    { date -u +"%Y%m%dT%H%M%SZ"; }
human_time()   { date -u +"%Y-%m-%d %H:%M:%S UTC"; }
backup_name()  { echo "backup-$(timestamp).db"; }

require_sqlite3() {
  if ! command -v sqlite3 &>/dev/null; then
    error "sqlite3 is required but not installed."
    error "Install it with: apt-get install sqlite3  OR  brew install sqlite3"
    exit 1
  fi
}

check_db_exists() {
  local db="$1"
  if [[ ! -f "$db" ]]; then
    error "Database not found: $db"
    error "Run 'npx prisma db push' in apps/api/ to create it first."
    exit 1
  fi
}

# ── Commands ──────────────────────────────────────────────────────────────────

cmd_backup() {
  require_sqlite3
  check_db_exists "$DB_PATH"

  mkdir -p "$BACKUP_DIR"
  local out_file="$BACKUP_DIR/$(backup_name)"

  info "Source:  $DB_PATH"
  info "Backup:  $out_file"
  info "Time:    $(human_time)"
  echo ""

  # Use SQLite's online backup API via .backup command — safe for live databases
  sqlite3 "$DB_PATH" ".backup '$out_file'"

  local src_size dest_size
  src_size=$(stat -c%s "$DB_PATH" 2>/dev/null || stat -f%z "$DB_PATH")
  dest_size=$(stat -c%s "$out_file" 2>/dev/null || stat -f%z "$out_file")

  ok "Backup created: $out_file"
  info "Size: source=${src_size}B  backup=${dest_size}B"

  # Basic integrity check on the backup itself
  if sqlite3 "$out_file" "PRAGMA integrity_check;" | grep -q "^ok$"; then
    ok "Backup integrity check passed."
  else
    fail "Backup integrity check FAILED."
    error "The backup file may be corrupt. Do not use it for restore."
    exit 1
  fi

  echo "$out_file"
}

cmd_restore() {
  local backup_file="${POSITIONAL:-}"

  if [[ -z "$backup_file" ]]; then
    error "Usage: $0 restore [--db <path>] <backup-file>"
    exit 1
  fi

  require_sqlite3

  if [[ ! -f "$backup_file" ]]; then
    error "Backup file not found: $backup_file"
    exit 1
  fi

  # Verify backup integrity before restoring
  info "Verifying backup integrity: $backup_file"
  if ! sqlite3 "$backup_file" "PRAGMA integrity_check;" | grep -q "^ok$"; then
    fail "Backup integrity check FAILED — aborting restore."
    exit 1
  fi
  ok "Backup integrity verified."

  # Safety: keep a copy of the current database before overwriting
  if [[ -f "$DB_PATH" ]]; then
    local safety_copy="${DB_PATH}.pre-restore-$(timestamp)"
    cp "$DB_PATH" "$safety_copy"
    warn "Existing database saved to: $safety_copy"
  fi

  info "Restoring: $backup_file → $DB_PATH"
  mkdir -p "$(dirname "$DB_PATH")"
  cp "$backup_file" "$DB_PATH"

  # Verify the restored database
  if sqlite3 "$DB_PATH" "PRAGMA integrity_check;" | grep -q "^ok$"; then
    ok "Restore complete. Database integrity verified."
  else
    fail "Restored database failed integrity check."
    error "Reverting to pre-restore copy: $safety_copy"
    cp "$safety_copy" "$DB_PATH"
    exit 1
  fi
}

cmd_drill() {
  heading "Backup / Restore Drill"
  echo ""
  info "Started: $(human_time)"
  echo ""

  require_sqlite3

  local errors=0

  # ── Step 1: Verify source database ────────────────────────────────────────
  heading "Step 1: Source database check"
  if [[ ! -f "$DB_PATH" ]]; then
    warn "Database not found at $DB_PATH — creating an empty one for drill purposes."
    mkdir -p "$(dirname "$DB_PATH")"
    sqlite3 "$DB_PATH" "PRAGMA journal_mode=WAL;"
  fi

  if sqlite3 "$DB_PATH" "PRAGMA integrity_check;" | grep -q "^ok$"; then
    ok "Source database integrity check passed."
  else
    fail "Source database integrity check FAILED."
    errors=$((errors + 1))
  fi

  # Record row counts for verification after restore
  local workspace_count contract_count interaction_count audit_count share_count
  workspace_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM workspaces;" 2>/dev/null || echo "0")
  contract_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM saved_contracts;" 2>/dev/null || echo "0")
  interaction_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM saved_interactions;" 2>/dev/null || echo "0")
  audit_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audit_logs;" 2>/dev/null || echo "0")
  share_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM share_links;" 2>/dev/null || echo "0")

  info "Row counts before backup:"
  info "  workspaces:         $workspace_count"
  info "  saved_contracts:    $contract_count"
  info "  saved_interactions: $interaction_count"
  info "  audit_logs:         $audit_count"
  info "  share_links:        $share_count"
  echo ""

  # ── Step 2: Create backup ──────────────────────────────────────────────────
  heading "Step 2: Create backup"
  mkdir -p "$BACKUP_DIR"
  local backup_file="$BACKUP_DIR/drill-$(timestamp).db"

  sqlite3 "$DB_PATH" ".backup '$backup_file'"

  if [[ -f "$backup_file" ]]; then
    ok "Backup created: $backup_file"
  else
    fail "Backup file was not created."
    errors=$((errors + 1))
  fi

  if sqlite3 "$backup_file" "PRAGMA integrity_check;" | grep -q "^ok$"; then
    ok "Backup integrity check passed."
  else
    fail "Backup integrity check FAILED."
    errors=$((errors + 1))
  fi
  echo ""

  # ── Step 3: Restore to a temp location ────────────────────────────────────
  heading "Step 3: Restore to temporary location"
  local restore_target="/tmp/drill-restore-$(timestamp).db"
  cp "$backup_file" "$restore_target"

  if sqlite3 "$restore_target" "PRAGMA integrity_check;" | grep -q "^ok$"; then
    ok "Restored database integrity check passed."
  else
    fail "Restored database integrity check FAILED."
    errors=$((errors + 1))
  fi
  echo ""

  # ── Step 4: Verify row counts match ───────────────────────────────────────
  heading "Step 4: Verify row counts"
  local restored_workspaces restored_contracts restored_interactions restored_audit restored_shares
  restored_workspaces=$(sqlite3 "$restore_target" "SELECT COUNT(*) FROM workspaces;" 2>/dev/null || echo "-1")
  restored_contracts=$(sqlite3 "$restore_target" "SELECT COUNT(*) FROM saved_contracts;" 2>/dev/null || echo "-1")
  restored_interactions=$(sqlite3 "$restore_target" "SELECT COUNT(*) FROM saved_interactions;" 2>/dev/null || echo "-1")
  restored_audit=$(sqlite3 "$restore_target" "SELECT COUNT(*) FROM audit_logs;" 2>/dev/null || echo "-1")
  restored_shares=$(sqlite3 "$restore_target" "SELECT COUNT(*) FROM share_links;" 2>/dev/null || echo "-1")

  check_count() {
    local table="$1" expected="$2" actual="$3"
    if [[ "$expected" == "$actual" ]]; then
      ok "$table: $actual rows (matches)"
    else
      fail "$table: expected $expected rows, got $actual"
      errors=$((errors + 1))
    fi
  }

  check_count "workspaces"         "$workspace_count"    "$restored_workspaces"
  check_count "saved_contracts"    "$contract_count"     "$restored_contracts"
  check_count "saved_interactions" "$interaction_count"  "$restored_interactions"
  check_count "audit_logs"         "$audit_count"        "$restored_audit"
  check_count "share_links"        "$share_count"        "$restored_shares"
  echo ""

  # ── Cleanup temp restore ───────────────────────────────────────────────────
  rm -f "$restore_target"

  # ── Summary ───────────────────────────────────────────────────────────────
  heading "Drill Summary"
  info "Completed: $(human_time)"
  info "Backup:    $backup_file"
  echo ""

  if [[ $errors -eq 0 ]]; then
    ok "All drill checks passed. Backup is restorable."
    exit 0
  else
    fail "$errors drill check(s) FAILED."
    error "The backup may not be reliable. Investigate before relying on it."
    exit 1
  fi
}

cmd_list() {
  if [[ ! -d "$BACKUP_DIR" ]]; then
    info "No backup directory found at: $BACKUP_DIR"
    return
  fi

  heading "Available backups in $BACKUP_DIR"
  echo ""
  local count=0
  while IFS= read -r -d '' f; do
    local size
    size=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f")
    printf "  %-50s  %s bytes\n" "$(basename "$f")" "$size"
    count=$((count + 1))
  done < <(find "$BACKUP_DIR" -maxdepth 1 -name "*.db" -print0 | sort -z)

  echo ""
  info "Total: $count backup(s)"
}

cmd_prune() {
  if [[ ! -d "$BACKUP_DIR" ]]; then
    info "No backup directory found — nothing to prune."
    return
  fi

  heading "Pruning backups (keeping $KEEP_COUNT most recent)"
  echo ""

  local all_backups=()
  while IFS= read -r -d '' f; do
    all_backups+=("$f")
  done < <(find "$BACKUP_DIR" -maxdepth 1 -name "*.db" -print0 | sort -rz)

  local total=${#all_backups[@]}
  if [[ $total -le $KEEP_COUNT ]]; then
    info "Only $total backup(s) found — nothing to prune."
    return
  fi

  local to_delete=$(( total - KEEP_COUNT ))
  info "Removing $to_delete old backup(s)..."

  for (( i=KEEP_COUNT; i<total; i++ )); do
    rm -f "${all_backups[$i]}"
    info "  Removed: $(basename "${all_backups[$i]}")"
  done

  ok "Pruning complete. $KEEP_COUNT backup(s) retained."
}

cmd_verify() {
  require_sqlite3
  check_db_exists "$DB_PATH"

  info "Verifying database integrity: $DB_PATH"
  if sqlite3 "$DB_PATH" "PRAGMA integrity_check;" | grep -q "^ok$"; then
    ok "Database integrity check passed."
  else
    fail "Database integrity check FAILED."
    exit 1
  fi

  # INFRA-825: Extended backup integrity validation
  heading "Extended Backup Integrity Checks"
  local errors=0

  if [[ -d "$BACKUP_DIR" ]]; then
    local backup_files=()
    while IFS= read -r -d '' f; do
      backup_files+=("$f")
    done < <(find "$BACKUP_DIR" -maxdepth 1 -name "*.db" -print0 | sort -rz)

    if [[ ${#backup_files[@]} -gt 0 ]]; then
      info "Found ${#backup_files[@]} backup(s) in $BACKUP_DIR"

      # Verify the most recent backup
      local latest="${backup_files[0]}"
      info "Verifying latest backup: $(basename "$latest")"
      if sqlite3 "$latest" "PRAGMA integrity_check;" | grep -q "^ok$"; then
        ok "Latest backup integrity check passed: $(basename "$latest")"
      else
        fail "Latest backup integrity check FAILED: $(basename "$latest")"
        errors=$((errors + 1))
      fi

      # Verify backup age
      local backup_mtime
      backup_mtime=$(stat -c%Y "$latest" 2>/dev/null || stat -f%m "$latest")
      local now
      now=$(date +%s)
      local age_hours=$(( (now - backup_mtime) / 3600 ))
      if [[ $age_hours -gt 24 ]]; then
        warn "Most recent backup is ${age_hours}h old — consider running a fresh backup"
      else
        ok "Most recent backup is ${age_hours}h old — within 24h window"
      fi
    else
      warn "No backups found in $BACKUP_DIR — run 'backup' command first"
    fi
  else
    warn "Backup directory $BACKUP_DIR does not exist — create it with 'backup' command"
  fi

  # Verify the backup restore workflow exists
  if [[ -f ".github/workflows/backup-restore-drill.yml" ]]; then
    ok "Backup restore workflow (.github/workflows/backup-restore-drill.yml) is present"
  else
    warn "Backup restore workflow not found — CI-based backup validation is not active"
  fi

  if [[ $errors -gt 0 ]]; then
    fail "$errors backup integrity issue(s) found"
    exit 1
  fi
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
case "$COMMAND" in
  backup)  cmd_backup  ;;
  restore) cmd_restore ;;
  drill)   cmd_drill   ;;
  list)    cmd_list    ;;
  prune)   cmd_prune   ;;
  verify)  cmd_verify  ;;
  *)
    echo "Usage: $0 <backup|restore|drill|list|prune> [options]"
    echo ""
    echo "Commands:"
    echo "  backup   [--db <path>] [--out <dir>]   Create a backup"
    echo "  restore  [--db <path>] <backup-file>   Restore from a backup"
    echo "  drill    [--db <path>] [--out <dir>]   Full backup→restore→verify cycle"
    echo "  list     [--out <dir>]                 List available backups"
    echo "  prune    [--out <dir>] [--keep <n>]    Remove old backups"
    echo "  verify   [--db <path>]                 Quick integrity check for the active DB"
    echo ""
    echo "Environment variables:"
    echo "  DB_PATH     Path to SQLite database (default: apps/api/prisma/dev.db)"
    echo "  BACKUP_DIR  Backup output directory  (default: .backups)"
    echo "  KEEP_COUNT  Backups to keep on prune (default: 10)"
    exit 1
    ;;
esac
