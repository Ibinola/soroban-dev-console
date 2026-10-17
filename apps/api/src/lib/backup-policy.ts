import path from "node:path";

export interface BackupConfig {
  enabled: boolean;
  /** Minutes between scheduled backups. */
  intervalMinutes: number;
  dir: string;
  /** Always keep at least this many of the newest backups (0 = no minimum). */
  retainCount: number;
  /** Delete backups older than this many days (0 = never by age). */
  retainDays: number;
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  enabled: false,
  intervalMinutes: 24 * 60,
  dir: ".backups",
  retainCount: 7,
  retainDays: 30,
};

function positiveInt(value: string | undefined, fallback: number, allowZero = false): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || (n === 0 && !allowZero)) return fallback;
  return n;
}

/** Reads the schedule and retention policy from the environment. */
export function parseBackupConfig(env: NodeJS.ProcessEnv = process.env): BackupConfig {
  return {
    enabled: env.BACKUP_ENABLED === "true",
    intervalMinutes: positiveInt(env.BACKUP_INTERVAL_MINUTES, DEFAULT_BACKUP_CONFIG.intervalMinutes),
    dir: env.BACKUP_DIR?.trim() || DEFAULT_BACKUP_CONFIG.dir,
    retainCount: positiveInt(env.BACKUP_RETAIN_COUNT, DEFAULT_BACKUP_CONFIG.retainCount, true),
    retainDays: positiveInt(env.BACKUP_RETAIN_DAYS, DEFAULT_BACKUP_CONFIG.retainDays, true),
  };
}

export const BACKUP_FILE_PREFIX = "backup_";
export const BACKUP_FILE_SUFFIX = ".db";

export function backupFileName(at: Date): string {
  const stamp = at.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return `${BACKUP_FILE_PREFIX}${stamp}${BACKUP_FILE_SUFFIX}`;
}

export function isBackupFile(name: string): boolean {
  return name.startsWith(BACKUP_FILE_PREFIX) && name.endsWith(BACKUP_FILE_SUFFIX);
}

export interface BackupFile {
  name: string;
  mtimeMs: number;
}

export interface RetentionPlan {
  keep: string[];
  remove: string[];
}

/**
 * Decides which backups to delete. The newest `retainCount` are always kept;
 * beyond that, backups older than `retainDays` are removed. With both limits
 * at 0 nothing is ever removed.
 */
export function planRetention(
  files: BackupFile[],
  config: Pick<BackupConfig, "retainCount" | "retainDays">,
  nowMs: number,
): RetentionPlan {
  const sorted = files.filter((f) => isBackupFile(f.name)).sort((a, b) => b.mtimeMs - a.mtimeMs);
  const maxAgeMs = config.retainDays * 86_400_000;
  const keep: string[] = [];
  const remove: string[] = [];
  sorted.forEach((f, index) => {
    const protectedByCount = index < config.retainCount;
    const tooOld = config.retainDays > 0 && nowMs - f.mtimeMs > maxAgeMs;
    // With a count limit and no age limit, the count is a hard cap.
    const overCountCap = config.retainDays === 0 && config.retainCount > 0 && index >= config.retainCount;
    if (overCountCap || (!protectedByCount && tooOld)) remove.push(f.name);
    else keep.push(f.name);
  });
  return { keep, remove };
}

/** Extracts the SQLite file path from a `file:` DATABASE_URL (relative to `baseDir`). */
export function sqlitePathFromUrl(databaseUrl: string | undefined, baseDir: string): string | null {
  if (!databaseUrl || !databaseUrl.startsWith("file:")) return null;
  const raw = databaseUrl.slice("file:".length).split("?")[0];
  if (!raw) return null;
  return path.isAbsolute(raw) ? raw : path.resolve(baseDir, raw);
}
