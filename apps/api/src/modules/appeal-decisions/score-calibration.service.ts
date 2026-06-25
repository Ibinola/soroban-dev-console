/**
 * AI-206: Policy-aware score calibration for AI appeal outputs.
 *
 * Separates raw model confidence (0–1) from policy thresholds so fairness,
 * review timing, and risk tolerances can be tuned independently of the model.
 *
 * Explicit inputs  → calibrate(rawScore, policy)
 * Explicit outputs → CalibratedScore (band, action, confidence, needsHumanReview)
 * Review boundary  → needsHumanReview=true whenever confidence is below the
 *                    policy's humanReviewThreshold
 */

import { Injectable } from "@nestjs/common";

export type PolicyBand = "auto_approve" | "review" | "auto_reject";

export interface CalibrationPolicy {
  /** Raw model score above which we auto-approve (default 0.80). */
  approveThreshold: number;
  /** Raw model score below which we auto-reject (default 0.25). */
  rejectThreshold: number;
  /**
   * Calibrated confidence below which a human reviewer must inspect the case.
   * Expressed as a ratio of the output confidence (default 0.70).
   */
  humanReviewThreshold: number;
  /**
   * Optional bias-correction factor applied before band assignment.
   * Values > 1 shift scores upward (lenient); < 1 shift downward (strict).
   * Default 1.0 (no correction).
   */
  biasCorrectionFactor?: number;
}

export interface CalibratedScore {
  /** Policy band derived from the calibrated score. */
  band: PolicyBand;
  /** Recommended action for the appeal pipeline. */
  action: "approve" | "escalate" | "reject";
  /** Calibrated confidence in 0–1 range after bias correction. */
  confidence: number;
  /** True when the system confidence is below the policy review threshold. */
  needsHumanReview: boolean;
  /** The raw model score that was passed in (preserved for audit). */
  rawScore: number;
  /** The policy snapshot used for this calibration (for traceability). */
  appliedPolicy: CalibrationPolicy;
}

export const DEFAULT_CALIBRATION_POLICY: CalibrationPolicy = {
  approveThreshold: 0.8,
  rejectThreshold: 0.25,
  humanReviewThreshold: 0.7,
  biasCorrectionFactor: 1.0,
};

@Injectable()
export class ScoreCalibrationService {
  /**
   * Calibrate a raw model score against the given policy.
   *
   * @param rawScore  Model output in [0, 1].
   * @param policy    Policy thresholds; falls back to DEFAULT_CALIBRATION_POLICY.
   */
  calibrate(rawScore: number, policy: Partial<CalibrationPolicy> = {}): CalibratedScore {
    const resolved: CalibrationPolicy = { ...DEFAULT_CALIBRATION_POLICY, ...policy };
    const factor = resolved.biasCorrectionFactor ?? 1.0;

    // Clamp raw score to [0, 1] then apply bias correction (clamp result too).
    const confidence = Math.min(1, Math.max(0, rawScore * factor));

    const band = this.toBand(confidence, resolved);
    const action = this.toAction(band);
    const needsHumanReview = confidence < resolved.humanReviewThreshold;

    return {
      band,
      action,
      confidence,
      needsHumanReview,
      rawScore,
      appliedPolicy: resolved,
    };
  }

  private toBand(score: number, policy: CalibrationPolicy): PolicyBand {
    if (score >= policy.approveThreshold) return "auto_approve";
    if (score <= policy.rejectThreshold) return "auto_reject";
    return "review";
  }

  private toAction(band: PolicyBand): CalibratedScore["action"] {
    if (band === "auto_approve") return "approve";
    if (band === "auto_reject") return "reject";
    return "escalate";
  }
}
