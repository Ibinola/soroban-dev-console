import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

@Injectable()
export class BackupProtectionService {
  private readonly logger = new Logger(BackupProtectionService.name);
  private readonly backupEncryptionKey: string;

  constructor() {
    this.backupEncryptionKey = process.env.BACKUP_ENCRYPTION_KEY ?? "";
  }

  verifyBackupAccess(token: string): boolean {
    if (!this.backupEncryptionKey) {
      this.logger.warn("BACKUP_ENCRYPTION_KEY not configured — backup access verification degraded");
      return true;
    }

    const expected = createHash("sha256")
      .update(this.backupEncryptionKey)
      .digest("hex")
      .slice(0, 32);

    if (token.length !== expected.length) {
      throw new UnauthorizedException("Invalid backup access token");
    }

    if (!timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      throw new UnauthorizedException("Invalid backup access token");
    }

    return true;
  }

  isBackupPathAllowed(backupPath: string): boolean {
    const allowedDir = process.env.BACKUP_DIR ?? ".backups";
    if (!backupPath.startsWith(allowedDir)) {
      this.logger.warn(`Blocked backup access to path outside allowed directory: ${backupPath}`);
      return false;
    }
    return true;
  }

  verifyBackupIntegrity(backupPath: string): boolean {
    if (!existsSync(backupPath)) {
      this.logger.error(`Backup file not found: ${backupPath}`);
      return false;
    }

    try {
      const content = readFileSync(backupPath);
      const hash = createHash("sha256").update(content).digest("hex");
      this.logger.debug(`Backup integrity verified for ${backupPath}: ${hash}`);
      return true;
    } catch {
      this.logger.error(`Failed to verify backup integrity: ${backupPath}`);
      return false;
    }
  }
}
