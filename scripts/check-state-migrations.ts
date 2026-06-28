import { existsSync, readdirSync } from "fs";

const MIGRATION_DIR = "apps/api/prisma/migrations";

interface MigrationCheck {
  name: string;
  hasMigrationSql: boolean;
}

export function checkStateMigrations(): MigrationCheck[] {
  if (!existsSync(MIGRATION_DIR)) {
    console.warn(`Migration directory not found: ${MIGRATION_DIR}`);
    return [];
  }
  const dirs = readdirSync(MIGRATION_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  return dirs.map((name) => ({
    name,
    hasMigrationSql: existsSync(`${MIGRATION_DIR}/${name}/migration.sql`),
  }));
}

export function validateMigrations(): void {
  const checks = checkStateMigrations();
  if (!checks.length) { console.log("No migrations found."); return; }
  let failed = 0;
  for (const c of checks) {
    if (!c.hasMigrationSql) { console.error(`  [MISSING sql] ${c.name}`); failed++; }
    else console.log(`  [OK] ${c.name}`);
  }
  if (failed) { console.error(`${failed} migration(s) missing migration.sql`); process.exit(1); }
  else console.log(`All ${checks.length} migration(s) valid.`);
}

validateMigrations();
