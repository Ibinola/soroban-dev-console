/**
 * AI-212: Summarize maintainer review threads for faster appeal triage.
 */

import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { IsString, IsOptional } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const SUMMARIZER_MODEL_VERSION = "rules-v1.0.0" as const;

export interface SummarySignals {
  reviewCount: number;
  approvalCount: number;
  approvalRatio: number;
  totalComments: number;
  totalRequestedChanges: number;
  mergeStatus: string;
  contested: boolean;
  highCommentDensity: boolean;
}

export class SummarizeReviewDto {
  @IsString()
  pullRequestId!: string;
}

export class OverrideSummaryDto {
  @IsString()
  summaryText!: string;
  @IsOptional()
  @IsString()
  overrideNote?: string;
}

const HIGH_COMMENT_THRESHOLD = 10;

function buildSummary(
  pullRequestId: string,
  reviews: Array<{
    decision: string;
    commentCount: number;
    requestedChangesCount: number;
    mergeStatus: string;
  }>,
): { summaryText: string; signals: SummarySignals } {
  const reviewCount = reviews.length;
  const approvalCount = reviews.filter((r) => r.decision === "approved").length;
  const approvalRatio = reviewCount > 0 ? approvalCount / reviewCount : 0;
  const totalComments = reviews.reduce((sum, r) => sum + r.commentCount, 0);
  const totalRequestedChanges = reviews.reduce(
    (sum, r) => sum + r.requestedChangesCount,
    0,
  );
  const mergeStatus = reviews[reviews.length - 1]?.mergeStatus ?? "unknown";
  const contested = approvalCount > 0 && totalRequestedChanges > 0;
  const highCommentDensity = totalComments >= HIGH_COMMENT_THRESHOLD;

  const signals: SummarySignals = {
    reviewCount,
    approvalCount,
    approvalRatio: Math.round(approvalRatio * 1000) / 1000,
    totalComments,
    totalRequestedChanges,
    mergeStatus,
    contested,
    highCommentDensity,
  };

  const parts: string[] = [
    `PR ${pullRequestId} has ${reviewCount} review${reviewCount !== 1 ? "s" : ""}: ` +
      `${approvalCount} approval${approvalCount !== 1 ? "s" : ""}, ` +
      `${totalRequestedChanges} change request${totalRequestedChanges !== 1 ? "s" : ""}.`,
    `Total comments: ${totalComments}. Latest merge status: ${mergeStatus}.`,
  ];

  if (contested) parts.push("Thread is contested (approvals and change requests both present).");
  if (highCommentDensity) parts.push("High comment density -- manual review recommended.");

  return { summaryText: parts.join(" "), signals };
}

@Injectable()
export class ReviewSummarizerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async summarize(dto: SummarizeReviewDto, actorKey: string) {
    const reviews = await this.prisma.reviewContext.findMany({
      where: { pullRequestId: dto.pullRequestId },
      orderBy: { reviewedAt: "asc" },
    });

    if (reviews.length === 0) {
      throw new NotFoundException(
        `No review context found for PR ${dto.pullRequestId}`,
      );
    }

    const { summaryText, signals } = buildSummary(dto.pullRequestId, reviews);

    const record = await this.prisma.reviewSummary.upsert({
      where: { pullRequestId: dto.pullRequestId },
      create: {
        pullRequestId: dto.pullRequestId,
        summaryText,
        keySignals: signals as unknown as Prisma.InputJsonValue,
        modelVersion: SUMMARIZER_MODEL_VERSION,
      },
      update: {
        summaryText,
        keySignals: signals as unknown as Prisma.InputJsonValue,
        modelVersion: SUMMARIZER_MODEL_VERSION,
        humanOverride: false,
        overriddenBy: null,
        overrideNote: null,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "review.summarized",
      resourceType: "review_summary",
      resourceId: record.id,
      summary: `PR ${dto.pullRequestId} summarized: ${signals.reviewCount} reviews, contested=${signals.contested}`,
      metadata: {
        modelVersion: SUMMARIZER_MODEL_VERSION,
        signals,
      } as unknown as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getByPr(pullRequestId: string) {
    const record = await this.prisma.reviewSummary.findUnique({
      where: { pullRequestId },
    });
    if (!record) throw new NotFoundException("No summary found for this PR -- run summarize first");
    return record;
  }

  @MapDbErrors()
  async override(pullRequestId: string, actorKey: string, dto: OverrideSummaryDto) {
    const existing = await this.prisma.reviewSummary.findUnique({
      where: { pullRequestId },
    });
    if (!existing) throw new NotFoundException("No summary found -- run summarize first");

    const updated = await this.prisma.reviewSummary.update({
      where: { pullRequestId },
      data: {
        summaryText: dto.summaryText,
        humanOverride: true,
        overriddenBy: actorKey,
        overrideNote: dto.overrideNote ?? null,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "review.summary.overridden",
      resourceType: "review_summary",
      resourceId: existing.id,
      summary: `Human override on PR ${pullRequestId} summary`,
      metadata: { overrideNote: dto.overrideNote } as Prisma.InputJsonValue,
    });

    return updated;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.reviewSummary.findMany({
      orderBy: { createdAt: "desc" },
    });
  }
}
