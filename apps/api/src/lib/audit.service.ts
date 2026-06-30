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

  async query(query: { actor?: string; action?: string; resourceType?: string; resourceId?: string; skip?: number; take?: number; }) {
    const { skip = 0, take = 50, actor, action, resourceType, resourceId } = query;
    
    const where = {
      ...(actor && { actor }),
      ...(action && { action }),
      ...(resourceType && { resourceType }),
      ...(resourceId && { resourceId }),
    };

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
