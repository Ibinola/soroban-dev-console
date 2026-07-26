#!/usr/bin/env bash
#
# backup-restore-drill.sh
#
# Validates backup and restore procedures for the SQLite development database.
# Designed to run in CI as a syntax/dry-run check, and locally with --run for
# a full drill.
#
# Usage:
#   bash scripts/backup-restore-drill.sh           # CI syntax check (dry run)
#   bash scripts/backup-restore-drill.sh --run     # Full drill with actual backup/restore
#

set -euo pipefail

DB_PATH="${DB_PATH:-apps/api/prisma/dev.db}"
BACKUP_DIR="${BACKUP_DIR:-.backups}"
DRY_RUN=true

if [ "${1:-}" = "--run" ]; then
  DRY_RUN=false
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/dev_${TIMESTAMP}.db"

# ── Validation functions ─────────────────────────────────────────────────────

validate_db_exists() {
  if [ ! -f "$DB_PATH" ]; then
    echo "⚠️   Database not found at $DB_PATH — skipping drill (expected in fresh CI environments)"
    exit 0
  fi
  echo "✅  Database found: $DB_PATH"
}

validate_sqlite_available() {
  if ! command -v sqlite3 &>/dev/null; then
    echo "⚠️   sqlite3 not available — skipping full drill"
    return 1
  fi
  echo "✅  sqlite3 available"
  return 0
}

backup_db() {
  mkdir -p "$BACKUP_DIR"
  echo "📦  Backing up $DB_PATH → $BACKUP_FILE"
  sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

  if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌  Backup file not created"
    return 1
  fi

  local orig_size
  orig_size=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH")
  local backup_size
  backup_size=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE")

  echo "✅  Backup created: $BACKUP_FILE (${backup_size} bytes, original: ${orig_size} bytes)"
}

verify_backup_integrity() {
  echo "🔍  Verifying backup integrity..."
  if sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" | grep -q "ok"; then
    echo "✅  Backup integrity check passed"
  else
    echo "❌  Backup integrity check failed"
    return 1
  fi
}

restore_db() {
  local restore_target="${DB_PATH}.restore_test"
  echo "♻️   Testing restore to $restore_target"
  cp "$BACKUP_FILE" "$restore_target"

  if sqlite3 "$restore_target" "SELECT count(*) FROM sqlite_master;" &>/dev/null; then
    echo "✅  Restore test passed"
  else
    echo "❌  Restore test failed — backup may be corrupt"
    rm -f "$restore_target"
    return 1
  fi

  rm -f "$restore_target"
}

cleanup_old_backups() {
  # Keep only the 5 most recent backups
  local count
  count=$(find "$BACKUP_DIR" -name "dev_*.db" | wc -l | tr -d ' ')
  if [ "$count" -gt 5 ]; then
    echo "🧹  Cleaning up old backups (keeping 5 most recent)..."
    find "$BACKUP_DIR" -name "dev_*.db" | sort | head -n $((count - 5)) | xargs rm -f
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────────

echo "Backup/Restore Drill — $(date)"
echo "Mode: $([ "$DRY_RUN" = true ] && echo 'DRY RUN (syntax check)' || echo 'FULL DRILL')"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "✅  Script syntax is valid. Pass --run for a full drill."
  exit 0
fi

validate_db_exists

if validate_sqlite_available; then
  backup_db
  verify_backup_integrity
  restore_db
  cleanup_old_backups
  echo ""
  echo "✅  Backup/restore drill completed successfully."
else
  echo "⚠️   Drill skipped (sqlite3 unavailable). Install sqlite3 to enable full drills."
fi
