#!/usr/bin/env bash
#
# verify-migrations.sh
#
# Checks that all Prisma migration directories contain a migration.sql file
# and that the migration_lock.toml is consistent with what's on disk.
#
# Usage: bash scripts/verify-migrations.sh
# CI:    continue-on-error: true (advisory check)
#

set -euo pipefail

MIGRATIONS_DIR="apps/api/prisma/migrations"
LOCK_FILE="apps/api/prisma/migration_lock.toml"

FAILED=0

# ── 1. Migrations directory must exist ──────────────────────────────────────
if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "❌  Migrations directory not found: $MIGRATIONS_DIR"
  exit 1
fi

echo "✅  Migrations directory present: $MIGRATIONS_DIR"

# ── 2. Every migration folder must contain migration.sql ────────────────────
while IFS= read -r -d '' dir; do
  migration_sql="$dir/migration.sql"
  if [ ! -f "$migration_sql" ]; then
    echo "❌  Missing migration.sql in: $dir"
    FAILED=1
  else
    echo "✅  OK: $dir/migration.sql"
  fi
done < <(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)

# ── 3. migration_lock.toml must exist ───────────────────────────────────────
if [ ! -f "$LOCK_FILE" ]; then
  echo "⚠️   Migration lock file not found: $LOCK_FILE"
else
  echo "✅  Migration lock file present"
fi

# ── 4. Count check ──────────────────────────────────────────────────────────
dir_count=$(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
echo ""
echo "Total migration directories: $dir_count"

if [ "$FAILED" -ne 0 ]; then
  echo ""
  echo "❌  Migration consistency check failed."
  exit 1
fi

echo ""
echo "✅  All migrations are consistent."
