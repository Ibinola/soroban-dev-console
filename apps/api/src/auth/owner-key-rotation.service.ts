/**
 * Issue #756: Owner-key rotation support with grace period for active sessions.
 *
 * POST /api/owner/rotate — accepts { oldKey, newKey }
 * - Validates oldKey owns at least one workspace
 * - Updates all workspace ownerKey fields atomically in a transaction
 * - 24-hour grace period: old key still allows reads (not writes)
 * - Emits OWNER_KEY_ROTATED audit event
 * - Rate limit: max 1 rotation per hour per key
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { PrismaService } from "../lib/prisma.service.js";
import { AuditService } from "../lib/audit.service.js";

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** In-memory rate limit store: oldKey -> last rotation timestamp */
const rotationTimestamps = new Map<string, number>();

export interface RotateOwnerKeyDto {
  oldKey: string;
  newKey: string;
}

export interface GracePeriodEntry {
  oldKey: string;
  newKey: string;
  expiresAt: Date;
}

/** In-memory grace period store. In production this would be persisted. */
const gracePeriodStore = new Map<string, GracePeriodEntry>();

@Injectable()
export class OwnerKeyRotationService {
  private readonly logger = new Logger(OwnerKeyRotationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Rotate the owner key for all workspaces owned by oldKey → newKey.
   * Atomically updates all workspace records in a transaction.
   * Sets a 24-hour grace period for the old key (read-only).
   */
  async rotate(dto: RotateOwnerKeyDto): Promise<{ workspacesUpdated: number; gracePeriodExpiresAt: string }> {
    const { oldKey, newKey } = dto;

    if (oldKey === newKey) {
      throw new BadRequestException("New key must be different from the old key.");
    }

    // Issue #756: Rate limit — max 1 rotation per hour
    const lastRotation = rotationTimestamps.get(oldKey);
    if (lastRotation && Date.now() - lastRotation < RATE_LIMIT_WINDOW_MS) {
      const retryAfterMs = RATE_LIMIT_WINDOW_MS - (Date.now() - lastRotation);
      const retryAfterMin = Math.ceil(retryAfterMs / 60_000);
      this.logger.warn(`Owner-key rotation rate limited for key (hint: ...${oldKey.slice(-4)})`);
      throw new HttpException(
        `Owner key rotation is rate limited to once per hour. Retry in ${retryAfterMin} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Issue #756: Validate oldKey owns at least one workspace
    const workspaceCount = await this.prisma.workspace.count({
      where: { ownerKey: oldKey },
    });

    if (workspaceCount === 0) {
      throw new NotFoundException(
        "No workspaces found for the provided owner key. Rotation requires ownership of at least one workspace.",
      );
    }

    // Issue #756: Atomic update of all workspace ownerKey fields
    const updateResult = await this.prisma.$transaction(async (tx: any) => {
      const result = await tx.workspace.updateMany({
        where: { ownerKey: oldKey },
        data: { ownerKey: newKey },
      });
      return result;
    });

    // Issue #756: Set 24-hour grace period for the old key (read-only access)
    const gracePeriodExpiresAt = new Date(Date.now() + GRACE_PERIOD_MS);
    gracePeriodStore.set(oldKey, {
      oldKey,
      newKey,
      expiresAt: gracePeriodExpiresAt,
    });

    // Record rotation timestamp for rate limiting
    rotationTimestamps.set(oldKey, Date.now());

    this.logger.log(`Owner key rotated: ${updateResult.count} workspace(s) updated`);

    // Issue #756: Emit OWNER_KEY_ROTATED audit event
    await this.audit.log({
      actor: oldKey,
      action: "owner_key.rotated",
      resourceType: "owner_key",
      resourceId: "rotation",
      summary: `Owner key rotated for ${updateResult.count} workspace(s). Grace period until ${gracePeriodExpiresAt.toISOString()}`,
      metadata: {
        workspacesUpdated: updateResult.count,
        gracePeriodExpiresAt: gracePeriodExpiresAt.toISOString(),
      },
    });

    return {
      workspacesUpdated: updateResult.count,
      gracePeriodExpiresAt: gracePeriodExpiresAt.toISOString(),
    };
  }

  /**
   * Check if an old key is within its grace period (read-only access).
   * Used by OwnerKeyGuard to allow reads from recently-rotated keys.
   */
  isInGracePeriod(key: string): boolean {
    const entry = gracePeriodStore.get(key);
    if (!entry) return false;
    if (entry.expiresAt < new Date()) {
      gracePeriodStore.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get the new key for a grace-period key (so the caller can be redirected).
   */
  getNewKeyForGracePeriod(oldKey: string): string | null {
    const entry = gracePeriodStore.get(oldKey);
    if (!entry || entry.expiresAt < new Date()) return null;
    return entry.newKey;
  }
}
