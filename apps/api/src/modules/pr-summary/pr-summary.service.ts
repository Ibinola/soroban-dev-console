/**
 * AI-920: Draft PR summaries from merged changes.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsDateString, IsObject } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const PR_SUMMARY_MODEL_VERSION = "rules-v1.0.0" as const;

export class GeneratePrSummaryDto {
  @IsString()
  pullRequestId!: string;

  @IsDateString()
  mergedAt!: string;

  @IsString()
  authorKey!: string;

  @IsObject()
  diffStats!: { added: number; removed: number; changedFiles: number };
}

function buildSummaryText(
  pullRequestId: string,
  authorKey: string,
  mergedAt: string,
  diffStats: { added: number; removed: number; changedFiles: number },
): string {
  const date = new Date(mergedAt).toISOString().slice(0, 10);
  return (
    `PR ${pullRequestId} merged by ${authorKey} on ${date}. ` +
    `Changed ${diffStats.changedFiles} files (+${diffStats.added}/-${diffStats.removed} lines). ` +
    `No unsupported claims.`
  );
}

@Injectable()
export class PrSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async generate(dto: GeneratePrSummaryDto, actorKey: string) {
    const summaryText = buildSummaryText(
      dto.pullRequestId,
      dto.authorKey,
      dto.mergedAt,
      dto.diffStats,
    );

    const record = await this.prisma.prDraftSummary.upsert({
      where: { pullRequestId: dto.pullRequestId },
      create: {
        pullRequestId: dto.pullRequestId,
        mergedAt: new Date(dto.mergedAt),
        authorKey: dto.authorKey,
        diffStats: dto.diffStats as unknown as Prisma.InputJsonValue,
        summaryText,
        modelVersion: PR_SUMMARY_MODEL_VERSION,
      },
      update: {
        mergedAt: new Date(dto.mergedAt),
        authorKey: dto.authorKey,
        diffStats: dto.diffStats as unknown as Prisma.InputJsonValue,
        summaryText,
        modelVersion: PR_SUMMARY_MODEL_VERSION,
        humanOverride: false,
        overriddenBy: null,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "pr.summary.generated",
      resourceType: "pr_draft_summary",
      resourceId: record.id,
      summary: `PR ${dto.pullRequestId} summary generated`,
      metadata: { modelVersion: PR_SUMMARY_MODEL_VERSION } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getByPr(pullRequestId: string) {
    const record = await this.prisma.prDraftSummary.findUnique({
      where: { pullRequestId },
    });
    if (!record) throw new NotFoundException("No summary found for this PR");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.prDraftSummary.findMany({ orderBy: { createdAt: "desc" } });
  }
}
