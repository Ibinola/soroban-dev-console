/**
 * AI-929: Highlight change impact across the repo.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsArray } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const CHANGE_IMPACT_MODEL_VERSION = "rules-v1.0.0" as const;

export interface ImpactArea {
  area: string;
  riskLevel: "low" | "medium" | "high";
  affectedPaths: string[];
  reason: string;
}

export class AnalyzeChangeImpactDto {
  @IsString()
  diffId!: string;

  @IsArray()
  changedFiles!: string[];
}

const AREA_RULES: Array<{ pattern: RegExp; area: string; risk: "low" | "medium" | "high"; reason: string }> = [
  { pattern: /prisma\/schema/, area: "database-schema", risk: "high", reason: "Schema changes may require migrations and affect all DB consumers" },
  { pattern: /src\/auth\//, area: "authentication", risk: "high", reason: "Auth changes affect all guarded endpoints" },
  { pattern: /app\.module\.ts/, area: "module-registry", risk: "medium", reason: "Module registration changes affect the entire app bootstrap" },
  { pattern: /src\/modules\/wave/, area: "wave", risk: "medium", reason: "Wave module changes affect contributor eligibility and appeals" },
  { pattern: /src\/modules\/budget/, area: "budget", risk: "medium", reason: "Budget changes affect point reservation and accounting" },
  { pattern: /src\/modules\/rpc/, area: "rpc-proxy", risk: "medium", reason: "RPC proxy changes affect all contract interactions" },
  { pattern: /src\/lib\//, area: "shared-utilities", risk: "medium", reason: "Shared lib changes propagate to all dependent modules" },
  { pattern: /src\/modules\//, area: "api-module", risk: "low", reason: "Module-scoped change with limited blast radius" },
  { pattern: /apps\/web\//, area: "frontend", risk: "low", reason: "Frontend-only change" },
];

function analyzeImpact(changedFiles: string[]): ImpactArea[] {
  const areaMap = new Map<string, ImpactArea>();

  for (const file of changedFiles) {
    for (const rule of AREA_RULES) {
      if (rule.pattern.test(file)) {
        const existing = areaMap.get(rule.area);
        if (existing) {
          existing.affectedPaths.push(file);
          if (rule.risk === "high" || (rule.risk === "medium" && existing.riskLevel === "low")) {
            existing.riskLevel = rule.risk;
          }
        } else {
          areaMap.set(rule.area, { area: rule.area, riskLevel: rule.risk, affectedPaths: [file], reason: rule.reason });
        }
        break;
      }
    }
  }

  return [...areaMap.values()].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.riskLevel] - order[b.riskLevel];
  });
}

@Injectable()
export class ChangeImpactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async analyze(dto: AnalyzeChangeImpactDto, actorKey: string) {
    const impactAreas = analyzeImpact(dto.changedFiles);
    const highRiskCount = impactAreas.filter((a) => a.riskLevel === "high").length;

    const record = await this.prisma.changeImpactAnalysis.upsert({
      where: { diffId: dto.diffId },
      create: {
        diffId: dto.diffId,
        changedFiles: dto.changedFiles as unknown as Prisma.InputJsonValue,
        impactAreas: impactAreas as unknown as Prisma.InputJsonValue,
        highRiskCount,
        modelVersion: CHANGE_IMPACT_MODEL_VERSION,
      },
      update: {
        changedFiles: dto.changedFiles as unknown as Prisma.InputJsonValue,
        impactAreas: impactAreas as unknown as Prisma.InputJsonValue,
        highRiskCount,
        modelVersion: CHANGE_IMPACT_MODEL_VERSION,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "change.impact.analyzed",
      resourceType: "change_impact_analysis",
      resourceId: record.id,
      summary: `Diff ${dto.diffId}: ${impactAreas.length} impact area(s), ${highRiskCount} high-risk`,
      metadata: { modelVersion: CHANGE_IMPACT_MODEL_VERSION, highRiskCount } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getByDiff(diffId: string) {
    const record = await this.prisma.changeImpactAnalysis.findUnique({ where: { diffId } });
    if (!record) throw new NotFoundException("No change impact analysis found for this diff");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.changeImpactAnalysis.findMany({ orderBy: { createdAt: "desc" } });
  }
}
