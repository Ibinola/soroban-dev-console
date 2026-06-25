/**
 * AI-923: Summarize CI failures for faster triage.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsArray } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const CI_SUMMARY_MODEL_VERSION = "rules-v1.0.0" as const;

export interface FailedStep {
  name: string;
  error: string;
}

export class SummarizeCiFailureDto {
  @IsString()
  runId!: string;

  @IsString()
  repository!: string;

  @IsString()
  branch!: string;

  @IsArray()
  failedSteps!: FailedStep[];

  @IsArray()
  affectedFiles!: string[];
}

function classifyError(error: string): string {
  const lower = error.toLowerCase();
  if (lower.includes("lint") || lower.includes("eslint") || lower.includes("prettier")) {
    return "Lint failure";
  }
  if (lower.includes("type") || lower.includes("tsc") || lower.includes("typescript")) {
    return "Type check failure";
  }
  if (lower.includes("test") || lower.includes("fail") || lower.includes("assertion")) {
    return "Test regression";
  }
  if (lower.includes("build") || lower.includes("compile")) {
    return "Build failure";
  }
  return "Unknown CI failure";
}

function deriveNextActions(causes: string[]): string[] {
  return causes.map((cause) => {
    switch (cause) {
      case "Lint failure": return "Run lint locally and fix reported issues";
      case "Type check failure": return "Run tsc --noEmit and fix type errors";
      case "Test regression": return "Run failing tests locally and investigate assertions";
      case "Build failure": return "Check build logs and resolve compilation errors";
      default: return "Review CI logs for more details";
    }
  });
}

@Injectable()
export class CiFailureSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async summarize(dto: SummarizeCiFailureDto, actorKey: string) {
    const likelyCauses = [
      ...new Set(dto.failedSteps.map((step) => classifyError(step.error))),
    ];
    const nextActions = deriveNextActions(likelyCauses);

    const record = await this.prisma.ciFailureSummary.upsert({
      where: { runId: dto.runId },
      create: {
        runId: dto.runId,
        repository: dto.repository,
        branch: dto.branch,
        failedSteps: dto.failedSteps as unknown as Prisma.InputJsonValue,
        affectedFiles: dto.affectedFiles as unknown as Prisma.InputJsonValue,
        likelyCauses: likelyCauses as unknown as Prisma.InputJsonValue,
        nextActions: nextActions as unknown as Prisma.InputJsonValue,
        modelVersion: CI_SUMMARY_MODEL_VERSION,
      },
      update: {
        repository: dto.repository,
        branch: dto.branch,
        failedSteps: dto.failedSteps as unknown as Prisma.InputJsonValue,
        affectedFiles: dto.affectedFiles as unknown as Prisma.InputJsonValue,
        likelyCauses: likelyCauses as unknown as Prisma.InputJsonValue,
        nextActions: nextActions as unknown as Prisma.InputJsonValue,
        modelVersion: CI_SUMMARY_MODEL_VERSION,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "ci.failure.summarized",
      resourceType: "ci_failure_summary",
      resourceId: record.id,
      summary: `CI run ${dto.runId} summarized: ${likelyCauses.join(", ")}`,
      metadata: { modelVersion: CI_SUMMARY_MODEL_VERSION } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getByRunId(runId: string) {
    const record = await this.prisma.ciFailureSummary.findUnique({ where: { runId } });
    if (!record) throw new NotFoundException("No CI failure summary found for this run");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.ciFailureSummary.findMany({ orderBy: { createdAt: "desc" } });
  }
}
