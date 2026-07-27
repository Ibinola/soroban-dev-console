/**
 * BE-011: Durable audit trail for workspace and share mutations.
 * BE-702: Retention policy and automated pruning.
 */

import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service.js";
import { redactJsonValue, redactText } from "../modules/security/services/redaction.service.js";

export interface AuditEntry {
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  summary?: string;
  metadata?: Prisma.InputJsonValue;
}

const CURSOR_DEFAULT_LIMIT = 50;
const CURSOR_MAX_LIMIT = 100;

/** Encode a composite (createdAt + id) cursor as a base64 string. */
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString("base64");
}

/** Decode a base64 composite cursor, returning null when malformed. */
function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (typeof parsed?.createdAt !== "string" || typeof parsed?.id !== "string") return null;
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly retentionDays: number;

  constructor(private readonly prisma: PrismaService) {
    this.retentionDays = Number(process.env.AUDIT_RETENTION_DAYS ?? 90);
  }

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actor: entry.actor,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        summary: entry.summary ? redactText(entry.summary) : null,
        metadata: entry.metadata ? (redactJsonValue(entry.metadata) as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  async findByResource(resourceType: string, resourceId: string) {
    return this.prisma.auditLog.findMany({
      where: { resourceType, resourceId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findAll(retentionDays?: number) {
    const days = retentionDays ?? this.retentionDays;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.prisma.auditLog.findMany({
      where: { createdAt: { gte: cutoff } },
      orderBy: { createdAt: "desc" },
    });
  }

  async prune(olderThanDays?: number) {
    const days = olderThanDays ?? this.retentionDays;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    this.logger.log(`Pruned ${result.count} audit logs older than ${days} days`);

    return { pruned: result.count, olderThanDays: days };
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleScheduledPrune() {
    await this.prune();
  }

  async query(query: {
    actor?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    skip?: number;
    take?: number;
    cursor?: string;
    limit?: number;
    createdAfter?: string;
    createdBefore?: string;
  }) {
    const { actor, action, resourceType, resourceId, createdAfter, createdBefore } = query;

    const createdAtFilter =
      createdAfter || createdBefore
        ? {
            ...(createdAfter && { gte: new Date(createdAfter) }),
            ...(createdBefore && { lte: new Date(createdBefore) }),
          }
        : undefined;

    const where = {
      ...(actor && { actor }),
      ...(action && { action }),
      ...(resourceType && { resourceType }),
      ...(resourceId && { resourceId }),
      ...(createdAtFilter && { createdAt: createdAtFilter }),
    };

    // Cursor-based pagination: stable across concurrent inserts. Ordering is
    // (createdAt desc, id desc) so the cursor uniquely identifies a position.
    if (query.cursor !== undefined || query.limit !== undefined) {
      const limit = Math.min(Math.max(query.limit ?? CURSOR_DEFAULT_LIMIT, 1), CURSOR_MAX_LIMIT);
      const decoded = query.cursor ? decodeCursor(query.cursor) : null;
      const cursorFilter = decoded
        ? {
            OR: [
              { createdAt: { lt: decoded.createdAt } },
              { createdAt: decoded.createdAt, id: { lt: decoded.id } },
            ],
          }
        : {};

      // Fetch one extra row to determine whether another page exists.
      const rows = await this.prisma.auditLog.findMany({
        where: { AND: [where, cursorFilter] },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const last = data[data.length - 1];
      const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

      return { data, pagination: { limit, nextCursor } };
    }

    // Legacy offset-based pagination (kept for backward compatibility).
    // `take` is clamped to the 100-row cap defensively, even though the DTO
    // already enforces it at the HTTP boundary.
    const { skip = 0 } = query;
    const take = Math.min(query.take ?? 50, CURSOR_MAX_LIMIT);

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const hasMore = skip + data.length < total;

    return { data, pagination: { total, skip, take, hasMore } };
  }
}