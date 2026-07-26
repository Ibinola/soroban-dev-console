/**
 * BE-011: Durable audit trail for workspace and share mutations.
 * BE-702: Retention policy and automated pruning.
 */

import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service.js";

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
        summary: entry.summary ?? null,
        metadata: entry.metadata ?? Prisma.JsonNull,
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
}
