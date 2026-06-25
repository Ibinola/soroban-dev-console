# AI-206: Policy-Aware Score Calibration for AI Appeal Outputs

## Overview

`ScoreCalibrationService` decouples raw model confidence (a float in `[0, 1]`)
from the policy thresholds that govern what happens next. This means fairness
parameters, review timing, and risk tolerances can be adjusted without touching
the model or rewriting the AI pipeline.

## Explicit Inputs / Outputs

| Direction | What it is |
|-----------|-----------|
| **Input** | `rawScore: number` — model confidence in `[0, 1]` |
| **Input** | `policy: Partial<CalibrationPolicy>` — operator-tunable thresholds |
| **Output** | `CalibratedScore.band` — `auto_approve \| review \| auto_reject` |
| **Output** | `CalibratedScore.action` — recommended pipeline action |
| **Output** | `CalibratedScore.needsHumanReview` — human gate flag |
| **Output** | `CalibratedScore.appliedPolicy` — policy snapshot for audit trail |

## Policy Knobs (`CalibrationPolicy`)

| Field | Default | Purpose |
|-------|---------|---------|
| `approveThreshold` | `0.80` | Score at or above → `auto_approve` |
| `rejectThreshold` | `0.25` | Score at or below → `auto_reject` |
| `humanReviewThreshold` | `0.70` | Confidence below this → `needsHumanReview=true` |
| `biasCorrectionFactor` | `1.0` | Multiply score before band assignment (> 1 = lenient) |

## Review Boundary

`needsHumanReview` is always `true` when `confidence < humanReviewThreshold`.
The caller must honour this flag before acting on `action`. The pipeline must
**not** auto-act when `needsHumanReview` is true.

## Measurability

Every `CalibratedScore` includes:
- `rawScore` — the unmodified model output (audit trail)
- `appliedPolicy` — the full policy snapshot used (reproducibility)

Operators can replay any historical score against updated policy values to
measure the effect of a threshold change before promoting it to production.

## File Location

`apps/api/src/modules/appeal-decisions/score-calibration.service.ts`
