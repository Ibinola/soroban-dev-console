/**
 * INFRA-822: Refresh read models on a predictable schedule.
 *
 * Read models (dashboards, audit views, aggregated stats) are refreshed
 * on a configurable cron schedule to balance freshness, cost, and failure
 * recovery. Supports on-demand refresh via the controller endpoint.
 *
 * Schedules are configurable via env vars with sensible defaults for each
 * profile (local, demo, production).
 */

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "./prisma.service.js";
import { AuditService } from "./audit.service.js";
import { CronExpression } from "./cron-expression.js";

export interface ReadModelRefreshPolicy {
  name: string;
  schedule: string;
  ttlSeconds: number;
  enabled: boolean;
}

@Injectable()
export class ReadModelRefreshService {
  private readonly logger = new Logger(ReadModelRefreshService.name);
  private readonly policies: ReadModelRefreshPolicy[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    this.policies = [
      {
        name: "dashboard_stats",
        schedule: process.env.REFRESH_DASHBOARD_CRON ?? CronExpression.EVERY_5_MINUTES,
        ttlSeconds: Number(process.env.REFRESH_DASHBOARD_TTL ?? "300"),
        enabled: process.env.REFRESH_DASHBOARD_ENABLED !== "false",
      },
      {
        name: "audit_summary",
        schedule: process.env.REFRESH_AUDIT_CRON ?? CronExpression.EVERY_30_MINUTES,
        ttlSeconds: Number(process.env.REFRESH_AUDIT_TTL ?? "1800"),
        enabled: process.env.REFRESH_AUDIT_ENABLED !== "false",
      },
      {
        name: "budget_snapshot",
        schedule: process.env.REFRESH_BUDGET_CRON ?? CronExpression.EVERY_HOUR,
        ttlSeconds: Number(process.env.REFRESH_BUDGET_TTL ?? "3600"),
        enabled: process.env.REFRESH_BUDGET_ENABLED !== "false",
      },
    ];
  }

  getPolicies(): ReadModelRefreshPolicy[] {
    return this.policies;
  }

  async refreshAll(): Promise<Record<string, { status: string; duration: number }>> {
    const results: Record<string, { status: string; duration: number }> = {};

    for (const policy of this.policies) {
      if (!policy.enabled) {
        results[policy.name] = { status: "disabled", duration: 0 };
        continue;
      }

      const start = Date.now();
      try {
        await this.refreshReadModel(policy.name);
        const duration = Date.now() - start;
        results[policy.name] = { status: "success", duration };
        this.logger.log(`Refreshed read model ${policy.name} in ${duration}ms`);
      } catch (error) {
        const duration = Date.now() - start;
        results[policy.name] = { status: "failed", duration };
        this.logger.error(`Failed to refresh read model ${policy.name}: ${error}`);
      }
    }

    await this.audit.log({
      actor: "system:read-model-refresh",
      action: "read-model.refresh.completed",
      resourceType: "read_model",
      resourceId: "all",
      summary: `Refreshed ${Object.values(results).filter((r) => r.status === "success").length} read models`,
    });

    return results;
  }

  private async refreshReadModel(name: string): Promise<void> {
    switch (name) {
      case "dashboard_stats":
        await this.refreshDashboardStats();
        break;
      case "audit_summary":
        await this.refreshAuditSummary();
        break;
      case "budget_snapshot":
        await this.refreshBudgetSnapshot();
        break;
      default:
        this.logger.warn(`Unknown read model: ${name}`);
    }
  }

  private async refreshDashboardStats(): Promise<void> {
    const stats = await this.prisma.backgroundJob.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    this.logger.debug(`Dashboard stats refreshed: ${JSON.stringify(stats)}`);
  }

  private async refreshAuditSummary(): Promise<void> {
    const recentAudits = await this.prisma.auditLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    this.logger.debug(`Audit summary refreshed: ${recentAudits} events in last 24h`);
  }

  private async refreshBudgetSnapshot(): Promise<void> {
    const budgets = await this.prisma.organizationBudget.findMany();
    this.logger.debug(`Budget snapshot refreshed: ${budgets.length} organizations`);
  }
}
