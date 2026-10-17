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

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (!this.config.enabled) return;
    this.timer = setInterval(() => void this.run(), this.config.intervalMinutes * 60_000);
    this.timer.unref();
    this.logger.log(
      `Backups every ${this.config.intervalMinutes} min to ${this.config.dir} ` +
        `(keep ${this.config.retainCount}, max ${this.config.retainDays} days)`,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
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
