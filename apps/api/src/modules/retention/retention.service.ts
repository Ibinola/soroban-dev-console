/**
 * INFRA-213: Data-retention lifecycle jobs for operational records.
 *
 * Enforces explicit, auditable retention windows for transient operational data:
 * - Notifications: 30 days (re-delivery not required after resolution)
 * - Dead background jobs: 14 days
 * - Resolved/closed appeal evidence (evidenceJson): 90 days
 *
 * Audit logs and financial records are EXCLUDED — they are retained indefinitely.
 * Runs are idempotent and safe to call multiple times (dry-run support included).
 * Operators can inspect health via the /retention/status endpoint.
 */

import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import type { RetentionRunResult, RetentionRunSummary } from "@devconsole/api-contracts";

export const RETENTION_POLICIES = [
  {
    resource: "notification_events",
    retentionDays: 30,
    description: "Delivered/failed notification events older than 30 days",
  },
  {
    resource: "background_jobs_dead",
    retentionDays: 14,
    description: "Dead background jobs older than 14 days",
  },
  {
    resource: "appeal_evidence",
    retentionDays: 90,
    description: "evidenceJson on resolved/rejected appeals older than 90 days (nulled, record kept)",
  },
] as const;

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async runAll(dryRun = false): Promise<RetentionRunSummary> {
    const ranAt = new Date();
    const results: RetentionRunResult[] = await Promise.all([
      this.purgeNotifications(dryRun),
      this.purgeDeadJobs(dryRun),
      this.nullAppealEvidence(dryRun),
    ]);

    const totalDeleted = results.reduce((s, r) => s + r.deletedCount, 0);

    if (!dryRun && totalDeleted > 0) {
      void this.audit.log({
        actor: "system:retention",
        action: "retention.run.completed",
        resourceType: "retention",
        resourceId: "lifecycle",
        summary: `Retention run deleted/nulled ${totalDeleted} records`,
        metadata: results as unknown as Prisma.InputJsonValue,
      });
    }

    this.logger.log(
      `Retention run (dryRun=${dryRun}): ${totalDeleted} records affected across ${results.length} resources`,
    );

    return { ranAt: ranAt.toISOString(), dryRun, results, totalDeleted };
  }

  policies() {
    return RETENTION_POLICIES;
  }

  private async purgeNotifications(dryRun: boolean): Promise<RetentionRunResult> {
    const retentionDays = 30;
    const cutoff = this.cutoffDate(retentionDays);

    const count = await this.prisma.notificationEvent.count({
      where: {
        deliveryStatus: { in: ["delivered", "failed"] },
        createdAt: { lt: cutoff },
      },
    });

    if (!dryRun && count > 0) {
      await this.prisma.notificationEvent.deleteMany({
        where: {
          deliveryStatus: { in: ["delivered", "failed"] },
          createdAt: { lt: cutoff },
        },
      });
    }

    return {
      resource: "notification_events",
      deletedCount: count,
      cutoffDate: cutoff.toISOString(),
      dryRun,
    };
  }

  private async purgeDeadJobs(dryRun: boolean): Promise<RetentionRunResult> {
    const retentionDays = 14;
    const cutoff = this.cutoffDate(retentionDays);

    const count = await this.prisma.backgroundJob.count({
      where: {
        status: "dead",
        updatedAt: { lt: cutoff },
      },
    });

    if (!dryRun && count > 0) {
      await this.prisma.backgroundJob.deleteMany({
        where: {
          status: "dead",
          updatedAt: { lt: cutoff },
        },
      });
    }

    return {
      resource: "background_jobs_dead",
      deletedCount: count,
      cutoffDate: cutoff.toISOString(),
      dryRun,
    };
  }

  private async nullAppealEvidence(dryRun: boolean): Promise<RetentionRunResult> {
    const retentionDays = 90;
    const cutoff = this.cutoffDate(retentionDays);

    const count = await this.prisma.appealCase.count({
      where: {
        status: { in: ["resolved", "rejected"] },
        updatedAt: { lt: cutoff },
        evidenceJson: { not: Prisma.JsonNullValueFilter.JsonNull },
      },
    });

    if (!dryRun && count > 0) {
      await this.prisma.appealCase.updateMany({
        where: {
          status: { in: ["resolved", "rejected"] },
          updatedAt: { lt: cutoff },
          evidenceJson: { not: Prisma.JsonNullValueFilter.JsonNull },
        },
        data: { evidenceJson: Prisma.JsonNull },
      });
    }

    return {
      resource: "appeal_evidence",
      deletedCount: count,
      cutoffDate: cutoff.toISOString(),
      dryRun,
    };
  }

  private cutoffDate(retentionDays: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - retentionDays);
    return d;
  }
}
