/**
 * BE-209: Aggregate maintainer review context for AI and human appeal analysis.
 *
 * Collects review comments, decisions, merge status, and timing signals into
 * a structured AppealContext model.
 */

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { DomainEventBus } from "../../lib/domain-event-bus.js";
import type {
  AppealContext,
  ReviewContextPayload,
  ReviewContextSummary,
} from "@devconsole/api-contracts";

export const REVIEW_CONTEXT_RECORDED = "review_context.recorded" as const;

@Injectable()
export class ReviewContextService {
  private readonly logger = new Logger(ReviewContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: DomainEventBus,
  ) {}

  async record(payload: ReviewContextPayload): Promise<ReviewContextSummary> {
    const record = await this.prisma.reviewContext.create({
      data: {
        pullRequestId: payload.pullRequestId,
        repositoryId: payload.repositoryId,
        reviewerId: payload.reviewerId,
        decision: payload.decision,
        commentCount: payload.commentCount,
        requestedChangesCount: payload.requestedChangesCount,
        mergeStatus: payload.mergeStatus,
        reviewedAt: new Date(payload.reviewedAt),
        metadata: (payload.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    this.events.emit(REVIEW_CONTEXT_RECORDED, {
      id: record.id,
      pullRequestId: record.pullRequestId,
      reviewerId: record.reviewerId,
      decision: record.decision,
    });

    void this.audit.log({
      actor: `reviewer:${payload.reviewerId}`,
      action: "review_context.recorded",
      resourceType: "review_context",
      resourceId: record.id,
      summary: `Review ${payload.decision} on PR ${payload.pullRequestId}`,
    });

    return this.toSummary(record);
  }

  /** Aggregate all review context for a pull request into an AppealContext. */
  async getAppealContext(pullRequestId: string): Promise<AppealContext> {
    const reviews = await this.prisma.reviewContext.findMany({
      where: { pullRequestId },
      orderBy: { reviewedAt: "asc" },
    });

    if (reviews.length === 0) {
      throw new NotFoundException(`No review context found for PR ${pullRequestId}`);
    }

    const latest = reviews[reviews.length - 1];

    return {
      pullRequestId,
      repositoryId: latest.repositoryId,
      reviews: reviews.map((r) => this.toSummary(r)),
      totalComments: reviews.reduce((sum, r) => sum + r.commentCount, 0),
      totalRequestedChanges: reviews.reduce((sum, r) => sum + r.requestedChangesCount, 0),
      approvalCount: reviews.filter((r) => r.decision === "approved").length,
      latestMergeStatus: latest.mergeStatus,
    };
  }

  async findByRepository(repositoryId: string): Promise<ReviewContextSummary[]> {
    const records = await this.prisma.reviewContext.findMany({
      where: { repositoryId },
      orderBy: { reviewedAt: "desc" },
    });
    return records.map((r) => this.toSummary(r));
  }

  private toSummary(r: {
    id: string;
    pullRequestId: string;
    repositoryId: string;
    reviewerId: string;
    decision: string;
    commentCount: number;
    requestedChangesCount: number;
    mergeStatus: string;
    reviewedAt: Date;
    createdAt: Date;
  }): ReviewContextSummary {
    return {
      id: r.id,
      pullRequestId: r.pullRequestId,
      repositoryId: r.repositoryId,
      reviewerId: r.reviewerId,
      decision: r.decision as ReviewContextSummary["decision"],
      commentCount: r.commentCount,
      requestedChangesCount: r.requestedChangesCount,
      mergeStatus: r.mergeStatus,
      reviewedAt: r.reviewedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    };
  }
}
