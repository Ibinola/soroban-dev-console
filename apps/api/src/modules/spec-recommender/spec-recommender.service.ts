/**
 * AI-934: Surface local spec recommendations.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsArray, IsOptional } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const SPEC_RECOMMENDER_MODEL_VERSION = "rules-v1.0.0" as const;

export interface SpecRecommendation {
  specPath: string;
  reason: string;
  priority: "must-run" | "should-run" | "nice-to-have";
}

export class RecommendSpecsDto {
  @IsString()
  changeSetId!: string;

  @IsArray()
  changedFiles!: string[];

  @IsOptional()
  @IsArray()
  existingTests?: string[];
}

const SPEC_RULES: Array<{
  filePattern: RegExp;
  specs: Array<{ path: string; reason: string; priority: SpecRecommendation["priority"] }>;
}> = [
  {
    filePattern: /apps\/api\/src\/modules\/wave/,
    specs: [
      { path: "apps/api/src/modules/wave/coordinated-abuse-detection.service.spec.ts", reason: "Wave module changes should validate abuse detection", priority: "must-run" },
    ],
  },
  {
    filePattern: /apps\/api\/src\/modules\/budget/,
    specs: [
      { path: "apps/api/src/modules/budget/budget-concurrency.test.ts", reason: "Budget changes should validate concurrency safety", priority: "must-run" },
    ],
  },
  {
    filePattern: /apps\/api\/src\/modules\/rpc/,
    specs: [
      { path: "apps/api/src/modules/rpc/transaction-normalizer.service.test.ts", reason: "RPC changes should validate transaction normalization", priority: "must-run" },
    ],
  },
  {
    filePattern: /apps\/api\/src\/modules\/support-tickets/,
    specs: [
      { path: "apps/api/src/modules/support-tickets/support-ticket-throttle.guard.test.ts", reason: "Support ticket changes should validate throttle guards", priority: "should-run" },
    ],
  },
  {
    filePattern: /apps\/api\/src\/modules\/maintainer-dashboard/,
    specs: [
      { path: "apps/api/src/modules/maintainer-dashboard/abuse-integrity-guardrails.spec.ts", reason: "Dashboard changes should validate integrity guardrails", priority: "should-run" },
      { path: "apps/api/src/modules/maintainer-dashboard/support-verification-appeals.spec.ts", reason: "Dashboard changes should cover appeals flow", priority: "should-run" },
    ],
  },
  {
    filePattern: /apps\/api\/src\/modules\/appeal-decisions/,
    specs: [
      { path: "apps/api/src/modules/appeal-decisions/score-calibration.service.spec.ts", reason: "Appeal decision changes should validate score calibration", priority: "must-run" },
      { path: "apps/api/src/modules/appeal-decisions/shadow-mode.service.spec.ts", reason: "Shadow mode may be affected by appeal decision changes", priority: "should-run" },
    ],
  },
  {
    filePattern: /prisma\/schema/,
    specs: [
      { path: "apps/api/src/modules/health/chaos-harness.test.ts", reason: "Schema changes should run chaos tests for data integrity", priority: "must-run" },
      { path: "apps/api/src/modules/rpc/transaction-normalizer.service.test.ts", reason: "Schema changes may affect transaction normalization", priority: "should-run" },
    ],
  },
  {
    filePattern: /apps\/web\//,
    specs: [
      { path: "apps/web/**/*.test.{ts,tsx}", reason: "Frontend changes should run web test suite", priority: "must-run" },
    ],
  },
];

function recommend(changedFiles: string[], existingTests: string[]): SpecRecommendation[] {
  const existingSet = new Set(existingTests.map((t) => t.toLowerCase()));
  const seen = new Set<string>();
  const recommendations: SpecRecommendation[] = [];

  for (const file of changedFiles) {
    for (const rule of SPEC_RULES) {
      if (rule.filePattern.test(file)) {
        for (const spec of rule.specs) {
          if (!seen.has(spec.path) && !existingSet.has(spec.path.toLowerCase())) {
            seen.add(spec.path);
            recommendations.push({ specPath: spec.path, reason: spec.reason, priority: spec.priority });
          }
        }
      }
    }
  }

  return recommendations.sort((a, b) => {
    const order = { "must-run": 0, "should-run": 1, "nice-to-have": 2 };
    return order[a.priority] - order[b.priority];
  });
}

@Injectable()
export class SpecRecommenderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async recommend(dto: RecommendSpecsDto, actorKey: string) {
    const recommendations = recommend(dto.changedFiles, dto.existingTests ?? []);
    const mustRunCount = recommendations.filter((r) => r.priority === "must-run").length;

    const record = await this.prisma.specRecommendation.upsert({
      where: { changeSetId: dto.changeSetId },
      create: {
        changeSetId: dto.changeSetId,
        changedFiles: dto.changedFiles as unknown as Prisma.InputJsonValue,
        recommendations: recommendations as unknown as Prisma.InputJsonValue,
        mustRunCount,
        modelVersion: SPEC_RECOMMENDER_MODEL_VERSION,
      },
      update: {
        changedFiles: dto.changedFiles as unknown as Prisma.InputJsonValue,
        recommendations: recommendations as unknown as Prisma.InputJsonValue,
        mustRunCount,
        modelVersion: SPEC_RECOMMENDER_MODEL_VERSION,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "spec.recommendation.generated",
      resourceType: "spec_recommendation",
      resourceId: record.id,
      summary: `Change set ${dto.changeSetId}: ${recommendations.length} spec(s) recommended, ${mustRunCount} must-run`,
      metadata: { modelVersion: SPEC_RECOMMENDER_MODEL_VERSION, mustRunCount } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getByChangeSet(changeSetId: string) {
    const record = await this.prisma.specRecommendation.findUnique({ where: { changeSetId } });
    if (!record) throw new NotFoundException("No spec recommendation found for this change set");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.specRecommendation.findMany({ orderBy: { createdAt: "desc" } });
  }
}
