/**
 * Migration lock and schema-state reporting (#1383).
 *
 * A held migration lock (another instance migrating, a SQLite writer holding the
 * database) used to look like a generic connection failure at startup. This
 * module classifies the failure, reports the migration phase and configured
 * timeout, and refuses to let startup continue while the schema state is
 * uncertain. Connection strings and credentials are always removed from text.
 */

export type MigrationPhase = "lock-acquisition" | "schema-check" | "migration-apply";

export type MigrationFailureKind = "LOCK_TIMEOUT" | "CONNECTION" | "UNCERTAIN_SCHEMA_STATE" | "UNKNOWN";

export class MigrationStartupError extends Error {
  constructor(
    readonly kind: MigrationFailureKind,
    readonly phase: MigrationPhase,
    readonly timeoutMs: number,
    message: string,
  ) {
    super(message);
    this.name = "MigrationStartupError";
  }
}

export const DEFAULT_MIGRATION_LOCK_TIMEOUT_MS = 10_000;

/** Timeout from MIGRATION_LOCK_TIMEOUT_MS; invalid values fall back to the default. */
export function resolveMigrationLockTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number.parseInt(env.MIGRATION_LOCK_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MIGRATION_LOCK_TIMEOUT_MS;
}

/** Remove connection strings, URL credentials and key/password assignments from text. */
export function redactConnectionDetails(text: string): string {
  return text
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'`]+/gi, "[redacted-connection]")
    .replace(/\bfile:[^\s"'`]+/gi, "[redacted-path]")
    .replace(/\b(password|passwd|pwd|secret|token|api[_-]?key)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

const LOCK_PATTERNS = [
  /advisory lock/i,
  /timed? ?out (trying|waiting) to acquire/i,
  /database is locked/i,
  /SQLITE_BUSY/i,
  /could not obtain lock/i,
  /lock (wait )?timeout/i,
];
const CONNECTION_PATTERNS = [/ECONNREFUSED/i, /ENOTFOUND/i, /can'?t reach database server/i, /connection (refused|terminated|closed)/i, /P1001/, /P1017/];

/** Classify a startup error and produce a safe, specific `MigrationStartupError`. */
export function classifyMigrationError(error: unknown, phase: MigrationPhase, timeoutMs: number): MigrationStartupError {
  if (error instanceof MigrationStartupError) return error;
  const raw = error instanceof Error ? `${(error as { code?: string }).code ?? ""} ${error.message}` : String(error);
  const safe = redactConnectionDetails(raw);

  if (LOCK_PATTERNS.some((p) => p.test(raw)) || /\bP1002\b/.test(raw)) {
    return new MigrationStartupError(
      "LOCK_TIMEOUT",
      phase,
      timeoutMs,
      `Migration lock not acquired during ${phase} within ${timeoutMs}ms: another process may be migrating or holding the database. Details: ${safe}`,
    );
  }
  if (CONNECTION_PATTERNS.some((p) => p.test(raw))) {
    return new MigrationStartupError("CONNECTION", phase, timeoutMs, `Could not connect to the database during ${phase}. Details: ${safe}`);
  }
  return new MigrationStartupError("UNKNOWN", phase, timeoutMs, `Schema check failed during ${phase}. Details: ${safe}`);
}

export interface MigrationRow {
  migration_name: string;
  finished_at: string | Date | null;
  rolled_back_at: string | Date | null;
}

/**
 * Rows of `_prisma_migrations` that started but neither finished nor rolled
 * back: the schema may be half-applied, so the state is uncertain.
 */
export function findUncertainMigrations(rows: readonly MigrationRow[]): string[] {
  return rows
    .filter((r) => (r.finished_at === null || r.finished_at === undefined) && (r.rolled_back_at === null || r.rolled_back_at === undefined))
    .map((r) => r.migration_name)
    .sort();
}

export interface SchemaStateReader {
  /** Returns null when the migrations table does not exist (db push / fresh database). */
  readMigrationRows(): Promise<MigrationRow[] | null>;
}

/**
 * Confirm the schema state before the API starts serving. Throws a
 * `MigrationStartupError` for a lock timeout, an unreachable database, or any
 * unfinished migration; resolves otherwise.
 */
export async function assertSchemaStateCertain(
  reader: SchemaStateReader,
  options: { timeoutMs?: number; phase?: MigrationPhase } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_MIGRATION_LOCK_TIMEOUT_MS;
  const phase = options.phase ?? "schema-check";

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new MigrationStartupError("LOCK_TIMEOUT", phase, timeoutMs, `Schema state check did not finish during ${phase} within ${timeoutMs}ms; the database may be locked by another process.`)),
      timeoutMs,
    );
    timer.unref?.();
  });

  try {
    const rows = await Promise.race([reader.readMigrationRows(), timeout]);
    if (rows === null) return;
    const uncertain = findUncertainMigrations(rows);
    if (uncertain.length > 0) {
      throw new MigrationStartupError(
        "UNCERTAIN_SCHEMA_STATE",
        phase,
        timeoutMs,
        `Schema state is uncertain: unfinished migration(s) ${uncertain.join(", ")}. Resolve with \`prisma migrate resolve\` before starting.`,
      );
    }
  } catch (error) {
    throw classifyMigrationError(error, phase, timeoutMs);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
