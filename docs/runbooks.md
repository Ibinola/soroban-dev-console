# Operational Runbooks

This document contains runbooks for common operational and incident scenarios for the Soroban DevConsole. Each runbook provides a short description of the scenario, symptoms to look for, and step-by-step recovery actions.

---

## Table of Contents

1. [API Service Restart](#1-api-service-restart)
2. [Database Migration Failure](#2-database-migration-failure)
3. [High RPC Error Rate](#3-high-rpc-error-rate)
4. [CI Pipeline Failures](#4-ci-pipeline-failures)
5. [Secret Exposure Response](#5-secret-exposure-response)
6. [Backup and Restore](#6-backup-and-restore)

---

## 1. API Service Restart

**Symptom:** The API is unresponsive or returning 502/503. The `/api/health` endpoint times out.

**Steps:**

1. Check the process/container logs for crash details.
2. Verify environment variables are set correctly (see `apps/api/.env.example`).
3. Confirm the database file is present: `apps/api/prisma/dev.db`.
4. Restart the process: `npm run dev --workspace=api`.
5. Confirm health: `curl http://localhost:4000/api/health`.
6. If the restart fails, check for port conflicts (`lsof -i :4000`).

**Post-recovery:** Record the incident in the audit log and check for repeated crashes.

---

## 2. Database Migration Failure

**Symptom:** The API fails to start with a Prisma migration error. Logs show `PrismaClientKnownRequestError` or migration version mismatch.

**Steps:**

1. Run `npm run prisma:migrate --workspace=api` to check migration status.
2. If migrations are in an inconsistent state, run: `npm run db:reset --workspace=api` (⚠️ **destructive** — only safe in development).
3. Re-run seed data: `npm run db:seed --workspace=api`.
4. In production, back up the database before any migration: `bash scripts/backup-restore-drill.sh --run`.
5. Apply pending migrations: `npm run prisma:deploy --workspace=api`.

**Post-recovery:** Verify the migration list is clean with `bash scripts/verify-migrations.sh`.

---

## 3. High RPC Error Rate

**Symptom:** Contract calls are failing. The `/api/health/networks` endpoint reports degraded network status.

**Steps:**

1. Check `GET /api/health/networks` for per-network status.
2. Identify the failing network (testnet / mainnet / futurenet).
3. Verify the Stellar Horizon and Soroban RPC endpoints for that network are reachable:
   ```
   curl https://horizon-testnet.stellar.org
   curl https://soroban-testnet.stellar.org
   ```
4. If public endpoints are down, consider switching to a custom RPC URL in Settings.
5. The RPC failover service (`apps/api/src/modules/rpc/rpc-failover.service.ts`) will automatically retry with fallback URLs if configured.
6. Monitor the transaction feed for recovery.

---

## 4. CI Pipeline Failures

**Symptom:** A PR is blocked by a failing CI job.

### Security job failure

- **Missing script:** Run `npm run security:scan` locally and check for any exposed secrets or policy violations.
- **Playbook validation:** Ensure `docs/runbooks.md` and `docs/observability.md` exist and are non-empty.

### DevOps job failure

- **Runtime drift:** Run `npm run check-drift` locally. Update `.env.example` to match `packages/api-contracts/src/runtime-defaults.ts`.
- **Dependency integrity:** Run `npm run check-integrity` locally. Resolve any inconsistent version declarations across workspaces.
- **Missing docs:** Create `docs/runbooks.md` or `docs/observability.md` if they were deleted.

### Web/API build failure

- Run `npm run build` locally and resolve TypeScript or lint errors.
- Check that all referenced scripts in `package.json` exist under `scripts/`.

---

## 5. Secret Exposure Response

**Symptom:** A secret (private key, API token, passphrase) has been committed to the repository or exposed in logs.

**Immediate steps:**

1. **Rotate the secret immediately.** Do not wait.
2. If the commit is recent and unmerged, remove it with `git rebase` before pushing.
3. If the commit has been pushed, contact the repository owner to purge the history.
4. Run `npm run security:scan` to identify any other secrets in the codebase.
5. Audit the `AuditLog` table for any actions taken with the exposed credential.
6. Update `.gitignore` and `.env.example` if a new file type was involved.

---

## 6. Backup and Restore

**Creating a backup:**

```bash
bash scripts/backup-restore-drill.sh --run
```

Backups are written to `.backups/dev_<timestamp>.db`. The script keeps the 5 most recent backups.

**Restoring from backup:**

```bash
cp .backups/dev_<timestamp>.db apps/api/prisma/dev.db
```

Then restart the API and verify health.

**CI syntax check:**

```bash
bash scripts/backup-restore-drill.sh
```

This validates script syntax without performing any database operations.

---

*Last updated: 2026-07-23*
