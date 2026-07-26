# Prisma Migration CI Check Guide

This document explains the CI enforcement rule that blocks pull requests if there are pending, unapplied Prisma schema migrations.

## Architecture

1. **Migration Checker Service**:
   - `apps/api/src/modules/devops/services/migration-checker.service.ts`: Evaluates the current Prisma migration status array to ensure `pendingCount === 0`.

2. **Web Status Badge**:
   - `MigrationStatusBadge`: React component used in the deployment dashboard to indicate database schema sync status.

3. **Validation Schemas & Interfaces**:
   - `migrationCheckResultSchema` and `MigrationCheckResult` defined in `@qyou/shared`.
