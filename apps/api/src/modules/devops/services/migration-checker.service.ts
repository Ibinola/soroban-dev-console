import {
  migrationCheckResultSchema,
  type MigrationCheckResult,
  type MigrationStatus,
} from '@qyou/shared';

export class MigrationCheckerService {
  public evaluateMigrations(migrations: MigrationStatus[]): MigrationCheckResult {
    const pendingCount = migrations.filter(m => m.isPending).length;
    
    const result: MigrationCheckResult = {
      checkId: `chk_${Date.now()}`,
      timestampIso: new Date().toISOString(),
      pendingCount,
      migrations,
      passed: pendingCount === 0,
    };

    return migrationCheckResultSchema.parse(result);
  }
}
