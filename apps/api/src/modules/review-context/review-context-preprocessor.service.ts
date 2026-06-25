/**
 * AI-202: Preprocess maintainer review context into a structured AI-ready representation.
 *
 * Converts raw ReviewContext records into an AIReadyReviewContext that:
 * - Derives an explicit signal from approval/changes-requested counts
 * - Assigns a measurable confidence score (0–1)
 * - Flags cases where human override is recommended
 *
 * Inputs, outputs, and boundaries are explicit — no hidden heuristics.
 * All thresholds are configurable via the PromptPolicy registry (AI-201).
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import type { AIReadyReviewContext, ReviewSignal } from "@devconsole/api-contracts";

const CONFIDENCE_FLOOR = 0.4;
const CONFIDENCE_CEIL = 1.0;

@Injectable()
export class ReviewContextPreprocessorService {
  constructor(private readonly prisma: PrismaService) {}

  async preprocess(pullRequestId: string): Promise<AIReadyReviewContext> {
    const reviews = await this.prisma.reviewContext.findMany({
      where: { pullRequestId },
      orderBy: { reviewedAt: "asc" },
    });

    if (reviews.length === 0) {
      throw new NotFoundException(`No review context found for PR ${pullRequestId}`);
    }

    const latest = reviews[reviews.length - 1];

    const approvalCount = reviews.filter((r) => r.decision === "approved").length;
    const changesRequestedCount = reviews.filter(
      (r) => r.decision === "changes_requested",
    ).length;
    const totalComments = reviews.reduce((s, r) => s + r.commentCount, 0);
    const totalRequestedChanges = reviews.reduce(
      (s, r) => s + r.requestedChangesCount,
      0,
    );
    const reviewerCount = new Set(reviews.map((r) => r.reviewerId)).size;

    const signal = this.deriveSignal(approvalCount, changesRequestedCount, reviewerCount);
    const confidence = this.computeConfidence(
      signal,
      reviewerCount,
      totalComments,
      totalRequestedChanges,
    );
    const humanOverrideRecommended = confidence < 0.6 || signal === "neutral";

    return {
      pullRequestId,
      repositoryId: latest.repositoryId,
      signal,
      confidence,
      reviewerCount,
      approvalCount,
      changesRequestedCount,
      totalComments,
      totalRequestedChanges,
      latestMergeStatus: latest.mergeStatus,
      humanOverrideRecommended,
      preprocessedAt: new Date().toISOString(),
    };
  }

  private deriveSignal(
    approvals: number,
    changesRequested: number,
    reviewerCount: number,
  ): ReviewSignal {
    if (changesRequested > 0 && approvals === 0) return "rejected";
    if (changesRequested > 0) return "changes_requested";
    if (approvals === 0) return "neutral";
    if (approvals >= 2 && reviewerCount >= 2) return "strong_approval";
    return "approval";
  }

  private computeConfidence(
    signal: ReviewSignal,
    reviewerCount: number,
    totalComments: number,
    totalChangesRequested: number,
  ): number {
    // Base score: more reviewers → higher confidence
    let score = Math.min(0.5 + reviewerCount * 0.15, 0.85);

    // Strong approval from multiple reviewers boosts confidence
    if (signal === "strong_approval") score = Math.min(score + 0.15, CONFIDENCE_CEIL);

    // Contested or ambiguous context lowers confidence
    if (signal === "neutral" || totalChangesRequested > 3) score -= 0.2;

    // High comment volume with no resolution lowers confidence
    if (totalComments > 10 && signal !== "strong_approval") score -= 0.1;

    return Math.max(CONFIDENCE_FLOOR, Math.min(CONFIDENCE_CEIL, parseFloat(score.toFixed(2))));
  }
}
