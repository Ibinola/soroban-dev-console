/**
 * AI-203: Assemble review evidence packs for AI-assisted appeal decisions.
 *
 * Packages code diffs, issue text, review comments, timestamps, and workflow
 * context into a deterministic evidence object before any model evaluation runs.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import type { ReviewEvidencePack, EvidencePackInput } from "@devconsole/api-contracts";

@Injectable()
export class EvidencePackService {
  constructor(private readonly prisma: PrismaService) {}

  /** Assemble a deterministic evidence pack for an appeal case. */
  async assemble(input: EvidencePackInput): Promise<ReviewEvidencePack> {
    const appeal = await this.prisma.appealCase.findFirst({
      where: { id: input.appealId },
    });
    if (!appeal) throw new NotFoundException(`Appeal case not found: ${input.appealId}`);

    const reviews = await this.prisma.reviewContext.findMany({
      where: { pullRequestId: input.pullRequestId },
      orderBy: { reviewedAt: "asc" },
    });

    const decisions = await this.prisma.appealDecision.findMany({
      where: { appealId: input.appealId },
      orderBy: { decidedAt: "desc" },
    });

    return {
      appealId: appeal.id,
      issueRef: appeal.issueRef,
      pullRequestId: input.pullRequestId,
      assembledAt: new Date().toISOString(),
      appeal: {
        reason: appeal.reason,
        status: appeal.status,
        createdAt: appeal.createdAt.toISOString(),
        resolvedAt: appeal.resolvedAt?.toISOString() ?? null,
        resolution: appeal.resolution ?? null,
        evidenceJson: (appeal.evidenceJson as Record<string, unknown> | null) ?? null,
      },
      reviewSummary: {
        totalReviews: reviews.length,
        approvalCount: reviews.filter((r: { decision: string }) => r.decision === "approved").length,
        changesRequestedCount: reviews.filter((r: { decision: string }) => r.decision === "changes_requested").length,
        totalComments: reviews.reduce((sum: number, r: { commentCount: number }) => sum + r.commentCount, 0),
        latestMergeStatus: reviews.at(-1)?.mergeStatus ?? "unknown",
        reviewTimeline: reviews.map((r: { reviewerId: string; decision: string; commentCount: number; reviewedAt: Date }) => ({
          reviewerId: r.reviewerId,
          decision: r.decision,
          commentCount: r.commentCount,
          reviewedAt: r.reviewedAt.toISOString(),
        })),
      },
      priorDecisions: decisions.map((d: { outcome: string; modelVersion: string | null; humanOverride: boolean; rationaleSummary: string | null; decidedAt: Date }) => ({
        outcome: d.outcome,
        modelVersion: d.modelVersion ?? null,
        humanOverride: d.humanOverride,
        rationaleSummary: d.rationaleSummary ?? null,
        decidedAt: d.decidedAt.toISOString(),
      })),
      workflowContext: input.workflowContext ?? null,
    };
  }
}
