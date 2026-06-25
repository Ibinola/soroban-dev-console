/**
 * AI-214: Continuous monitoring for AI pipeline health.
 *
 * Snapshots precision, override rate, fairness drift, and queue health
 * on demand. Each snapshot is immutable -- regressions are visible over time.
 * Humans inspect the trend; the system never auto-tunes without approval.
 */

import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { IsString, IsNumber, IsOptional, IsInt, Min, Max, IsIn } from "class-validator";
import { Type } from "class-transformer";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const MONITOR_MODEL_VERSION = "rules-v1.0.0" as const;

export const METRIC_TYPES = [
  "override_rate",
  "classification_precision",
  "fairness_drift",
  "queue_health",
] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

export const ALERT_THRESHOLDS: Record<MetricType, number> = {
  override_rate: 0.25,
  classification_precision: 0.70,
  fairness_drift: 0.15,
  queue_health: 0.50,
};

export class RecordSnapshotDto {
  @IsIn(METRIC_TYPES)
  metricType!: MetricType;

  @IsNumber()
  value!: number;

  @IsInt()
  @Min(1)
  @Max(720)
  windowHours!: number;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class ListSnapshotsDto {
  @IsOptional()
  @IsIn(METRIC_TYPES)
  metricType?: MetricType;

  @IsOptional()
  @IsString()
  modelVersion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}

function deriveAlert(metricType: MetricType, value: number): boolean {
  const threshold = ALERT_THRESHOLDS[metricType];
  if (metricType === "classification_precision" || metricType === "queue_health") {
    return value < threshold;
  }
  return value > threshold;
}

@Injectable()
export class AiMonitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async snapshot(dto: RecordSnapshotDto, actorKey: string) {
    const alertThreshold = ALERT_THRESHOLDS[dto.metricType];
    const alertTriggered = deriveAlert(dto.metricType, dto.value);

    const record = await this.prisma.aiMetricSnapshot.create({
      data: {
        modelVersion: MONITOR_MODEL_VERSION,
        metricType: dto.metricType,
        value: dto.value,
        windowHours: dto.windowHours,
        metadata: (dto.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        alertTriggered,
        alertThreshold,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "ai_monitor.snapshot.recorded",
      resourceType: "ai_metric_snapshot",
      resourceId: record.id,
      summary: `Metric ${dto.metricType}=${dto.value} (alert=${alertTriggered})`,
      metadata: {
        modelVersion: MONITOR_MODEL_VERSION,
        windowHours: dto.windowHours,
        alertThreshold,
      } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async list(query: ListSnapshotsDto = {}) {
    const take = query.take ?? 50;
    return this.prisma.aiMetricSnapshot.findMany({
      where: {
        ...(query.metricType ? { metricType: query.metricType } : {}),
        ...(query.modelVersion ? { modelVersion: query.modelVersion } : {}),
      },
      orderBy: { snapshotAt: "desc" },
      take,
    });
  }

  @MapDbErrors()
  async listAlerts() {
    return this.prisma.aiMetricSnapshot.findMany({
      where: { alertTriggered: true },
      orderBy: { snapshotAt: "desc" },
      take: 100,
    });
  }

  @MapDbErrors()
  async get(id: string) {
    const record = await this.prisma.aiMetricSnapshot.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("Metric snapshot not found");
    return record;
  }

  /** Compute a summary of the latest value per metric type. */
  @MapDbErrors()
  async summary() {
    const rows = await Promise.all(
      METRIC_TYPES.map(async (metricType) => {
        const latest = await this.prisma.aiMetricSnapshot.findFirst({
          where: { metricType },
          orderBy: { snapshotAt: "desc" },
        });
        return {
          metricType,
          latestValue: latest?.value ?? null,
          alertThreshold: ALERT_THRESHOLDS[metricType],
          alertTriggered: latest?.alertTriggered ?? false,
          snapshotAt: latest?.snapshotAt ?? null,
        };
      }),
    );
    return rows;
  }
}
