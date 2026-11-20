export interface MigrationStatus {
  migrationName: string;
  appliedAtIso?: string;
  isPending: boolean;
}

export interface MigrationCheckResult {
  checkId: string;
  timestampIso: string;
  pendingCount: number;
  migrations: MigrationStatus[];
  passed: boolean;
}
