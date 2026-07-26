/**
 * BE-011: Durable audit trail for workspace and share mutations.
 */

import { Injectable } from "@nestjs/common";
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
  constructor(private readonly prisma: PrismaService) {}

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

  async query(query: {
    actor?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    skip?: number;
    take?: number;
    cursor?: string;
    limit?: number;
  }) {
    const { actor, action, resourceType, resourceId } = query;

    const where = {
      ...(actor && { actor }),
      ...(action && { action }),
      ...(resourceType && { resourceType }),
      ...(resourceId && { resourceId }),
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
    const { skip = 0, take = 50 } = query;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, pagination: { total, skip, take } };
  }
}
