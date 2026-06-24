/**
 * AI-207: Generate contributor-facing appeal explanations from structured evidence.
 *
 * Produces concise, human-readable explanations that tell contributors why an
 * appeal succeeded, failed, or needs human follow-up — without exposing
 * sensitive moderation logic or model internals.
 *
 * Rules are explicit and enumerable so behaviour is measurable and safe to tune.
 * Humans can always override the result when the system lacks confidence.
 */

import { Injectable } from "@nestjs/common";
import type { ReviewEvidencePack, AppealExplanation } from "@devconsole/api-contracts";

@Injectable()
export class AppealExplanationService {
  /**
   * Derive a contributor-facing explanation from an assembled evidence pack
   * and the evaluator's outcome.
   *
   * @param pack       The deterministic evidence pack (AI-203 output)
   * @param outcome    The evaluator outcome: "approved" | "rejected" | "escalated"
   * @param confidence Confidence level reported by the evaluator
   */
  explain(
    pack: ReviewEvidencePack,
    outcome: "approved" | "rejected" | "escalated",
    confidence: "high" | "medium" | "low",
  ): AppealExplanation {
    const { reviewSummary: rs, priorDecisions } = pack;
    const hasHumanOverride = priorDecisions.some((d) => d.humanOverride);

    let headline: string;
    let detail: string;
    let nextSteps: string[];
    const requiresHumanReview = outcome === "escalated" || confidence === "low";

    if (outcome === "approved") {
      headline = "Your appeal has been approved.";
      detail =
        rs.approvalCount >= 2 && rs.latestMergeStatus === "merged"
          ? `Your pull request received ${rs.approvalCount} approvals and was merged. The evidence supports your appeal.`
          : `The evidence provided supports your appeal. Points will be credited shortly.`;
      nextSteps = ["Points will be applied to your account within one business day."];
    } else if (outcome === "rejected") {
      headline = "Your appeal was not approved.";
      detail =
        rs.changesRequestedCount > 0 && rs.approvalCount === 0
          ? `The review history shows ${rs.changesRequestedCount} change request(s) and no approvals. The pull request was closed without being merged.`
          : `The evidence did not meet the criteria for approval.`;
      nextSteps = [
        "Review the original feedback on your pull request.",
        "If you believe this is incorrect, you may contact a maintainer for a manual review.",
      ];
    } else {
      // escalated
      headline = "Your appeal has been forwarded to a maintainer for review.";
      if (hasHumanOverride) {
        detail =
          "A previous decision on this appeal was manually overridden. A maintainer will review the full history before making a final decision.";
      } else if (rs.totalReviews === 0) {
        detail =
          "No review activity was found for the associated pull request. A maintainer will investigate.";
      } else {
        detail =
          "The automated system could not reach a confident decision. A maintainer will review your appeal and respond directly.";
      }
      nextSteps = [
        "A maintainer will review your case and respond within 5 business days.",
        "No further action is required from you at this time.",
      ];
    }

    return {
      appealId: pack.appealId,
      outcome,
      confidence,
      requiresHumanReview,
      headline,
      detail,
      nextSteps,
      generatedAt: new Date().toISOString(),
    };
  }
}
