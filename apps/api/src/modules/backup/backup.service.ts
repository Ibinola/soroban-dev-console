import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import {
  backupFileName,
  isBackupFile,
  parseBackupConfig,
  planRetention,
  type BackupConfig,
} from "../../lib/backup-policy.js";
import { ScheduleGate } from "../../lib/schedule-gate.js";

/**
 * Takes periodic SQLite backups (`VACUUM INTO`, consistent while the app is
 * running) and prunes old ones per the retention policy. Disabled unless
 * BACKUP_ENABLED=true; see lib/backup-policy.ts for the settings.
 */
@Injectable()
export class BackupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupService.name);
  private readonly config: BackupConfig = parseBackupConfig();
  private timer: NodeJS.Timeout | null = null;
  /** #1382: stable key for the backup schedule; at most one active run per key. */
  private readonly scheduleKey = `backup:sqlite:${this.config.dir}:every-${this.config.intervalMinutes}m`;
  private readonly gate = new ScheduleGate((event) =>
    this.logger.log(`backup.schedule ${JSON.stringify(event)}`),
  );

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (!this.config.enabled) return;
    this.timer = setInterval(() => void this.runScheduled().catch(() => undefined), this.config.intervalMinutes * 60_000);
    this.timer.unref();
    this.logger.log(
      `Backups every ${this.config.intervalMinutes} min to ${this.config.dir} ` +
        `(keep ${this.config.retainCount}, max ${this.config.retainDays} days)`,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Scheduled entry point: runs a backup unless one is already active for this
   * schedule key. Duplicate triggers are skipped and logged with the key.
   */
  async runScheduled(now: Date = new Date()) {
    return this.gate.runOnce(this.scheduleKey, () => this.run(now));
  }

  /** Creates one backup, then applies retention. Returns the file written. */
  async run(now: Date = new Date()): Promise<string> {
    const dir = path.resolve(this.config.dir);
    await mkdir(dir, { recursive: true });
    const target = path.join(dir, backupFileName(now));
    // VACUUM INTO takes a string literal; escape single quotes in the path.
    await this.prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    await this.applyRetention(dir, now.getTime());
    return target;
  }

  private async applyRetention(dir: string, nowMs: number) {
    const names = (await readdir(dir)).filter(isBackupFile);
    const files = await Promise.all(
      names.map(async (name) => ({ name, mtimeMs: (await stat(path.join(dir, name))).mtimeMs })),
    );
    const { remove } = planRetention(files, this.config, nowMs);
    for (const name of remove) {
      await unlink(path.join(dir, name));
      this.logger.log(`Pruned old backup ${name}`);
    }
  }
}
