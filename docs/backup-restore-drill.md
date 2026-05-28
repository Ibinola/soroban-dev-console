# Backup and Restore Drill

> DEVOPS-214: Automated process for verifying that operational data can actually be restored, not just backed up.

## Overview

The backup/restore drill creates a timestamped SQLite backup, restores it to a temporary location, and verifies that all row counts match. This catches silent corruption, incomplete backups, and restore failures before they become incidents.

## Script

```bash
scripts/backup-restore-drill.sh <command> [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `drill` | Full cycle: backup → restore → verify (default) |
| `backup` | Create a backup only |
| `restore <file>` | Restore from a specific backup file |
| `list` | List available backups |
| `prune` | Remove old backups, keep N most recent |

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--db <path>` | `apps/api/prisma/dev.db` | Path to the SQLite database |
| `--out <dir>` | `.backups` | Directory for backup files |
| `--keep <n>` | `10` | Number of backups to retain on prune |

### Environment Variables

The same options can be set via environment variables:

```bash
export DB_PATH=apps/api/prisma/dev.db
export BACKUP_DIR=.backups
export KEEP_COUNT=10
```

## Running the Drill

```bash
# Full drill (backup → restore → verify)
./scripts/backup-restore-drill.sh drill

# Drill against a specific database
./scripts/backup-restore-drill.sh drill --db apps/api/prisma/demo.db --out .backups/demo

# Create a backup only
./scripts/backup-restore-drill.sh backup

# Restore from a specific backup
./scripts/backup-restore-drill.sh restore .backups/backup-20250115T100000Z.db

# List all backups
./scripts/backup-restore-drill.sh list

# Prune old backups, keep 5 most recent
./scripts/backup-restore-drill.sh prune --keep 5
```

## What the Drill Verifies

1. **Source integrity**: `PRAGMA integrity_check` on the live database.
2. **Backup creation**: SQLite's online backup API (safe for live databases).
3. **Backup integrity**: `PRAGMA integrity_check` on the backup file.
4. **Restore**: Copy backup to a temporary location.
5. **Restore integrity**: `PRAGMA integrity_check` on the restored file.
6. **Row count parity**: All tables (`workspaces`, `saved_contracts`, `saved_interactions`, `audit_logs`, `share_links`) must have identical row counts before and after.

If any step fails, the script exits with a non-zero status and prints an actionable error message.

## Automated Workflow

The `backup-restore-drill.yml` workflow runs every Sunday at 03:00 UTC and:

1. Seeds a fresh database using `prisma db seed`.
2. Runs the full drill.
3. Uploads the backup as a workflow artifact (retained 30 days).
4. Posts a `::error::` annotation if the drill fails.

You can also trigger it manually from the Actions tab, optionally specifying a custom database path.

## Backup Storage

Backups are written to `.backups/` by default. This directory is git-ignored. For production deployments, configure `BACKUP_DIR` to point to a durable storage location (e.g., a mounted volume or an S3-compatible bucket via a pre/post hook).

## Restore Safety

The `restore` command always saves a copy of the current database as `<db>.pre-restore-<timestamp>` before overwriting it. If the restored database fails its integrity check, the script automatically reverts to the pre-restore copy.

## Retention Policy

Run `prune` periodically to avoid unbounded disk usage:

```bash
# Keep the 10 most recent backups
./scripts/backup-restore-drill.sh prune --keep 10
```

The CI workflow does not auto-prune local backups. Prune manually or add a cron job for long-running environments.

## Failure Response

If the drill fails in CI:

1. Check the workflow logs for the specific step that failed.
2. Download the backup artifact and inspect it locally: `sqlite3 <backup-file> "PRAGMA integrity_check;"`
3. If the source database is corrupt, restore from the most recent passing backup.
4. If the backup process itself is failing, check disk space and SQLite version.
5. Open an issue with the `[DEVOPS]` label and link to the failed workflow run.
