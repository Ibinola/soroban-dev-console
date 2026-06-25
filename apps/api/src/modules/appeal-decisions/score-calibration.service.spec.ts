import { ScoreCalibrationService, DEFAULT_CALIBRATION_POLICY } from "./score-calibration.service.js";

describe("ScoreCalibrationService", () => {
  let svc: ScoreCalibrationService;

  beforeEach(() => {
    svc = new ScoreCalibrationService();
  });

  it("auto-approves high-confidence scores", () => {
    const result = svc.calibrate(0.9);
    expect(result.band).toBe("auto_approve");
    expect(result.action).toBe("approve");
    expect(result.needsHumanReview).toBe(false);
  });

  it("escalates mid-range scores and requires human review below threshold", () => {
    const result = svc.calibrate(0.5);
    expect(result.band).toBe("review");
    expect(result.action).toBe("escalate");
    expect(result.needsHumanReview).toBe(true);
  });

  it("auto-rejects low-confidence scores", () => {
    const result = svc.calibrate(0.1);
    expect(result.band).toBe("auto_reject");
    expect(result.action).toBe("reject");
    expect(result.needsHumanReview).toBe(true);
  });

  it("applies bias correction factor to shift scores upward", () => {
    // raw 0.7 * factor 1.2 = 0.84 → auto_approve
    const result = svc.calibrate(0.7, { biasCorrectionFactor: 1.2 });
    expect(result.band).toBe("auto_approve");
    expect(result.confidence).toBeCloseTo(0.84);
  });

  it("clamps corrected confidence to [0, 1]", () => {
    const result = svc.calibrate(0.95, { biasCorrectionFactor: 2.0 });
    expect(result.confidence).toBe(1);
  });

  it("preserves rawScore in output for audit trail", () => {
    const result = svc.calibrate(0.65, { biasCorrectionFactor: 1.1 });
    expect(result.rawScore).toBe(0.65);
  });

  it("includes the resolved policy in output for traceability", () => {
    const result = svc.calibrate(0.5);
    expect(result.appliedPolicy).toMatchObject(DEFAULT_CALIBRATION_POLICY);
  });

  it("respects custom thresholds", () => {
    const result = svc.calibrate(0.6, { approveThreshold: 0.55 });
    expect(result.band).toBe("auto_approve");
  });

  it("marks high-confidence mid-range score as not needing human review when threshold is low", () => {
    const result = svc.calibrate(0.75, { humanReviewThreshold: 0.5 });
    expect(result.needsHumanReview).toBe(false);
  });
});
