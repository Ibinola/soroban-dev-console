# AI-210: Coordinated Abuse Pattern Detection

## Overview

`CoordinatedAbuseDetectionService` spots coordinated rule-breaking, contributor
farming, and suspicious appeal clusters across the platform. It produces
operator-review signals and never takes automated action.

## Detected Patterns

| Pattern | Trigger |
|---------|---------|
| `VELOCITY_CLUSTER` | One contributor generates ≥ `velocityEventLimit` events in the window |
| `APPEAL_FLOODING` | One contributor submits ≥ `appealFloodLimit` appeals in the window |
| `ISSUE_FARMING` | One issue is claimed by ≥ `issueFarmingContributorLimit` distinct contributors in the window |
| `SHARED_METADATA` | ≥ 3 contributors share an identical metadata value (e.g., IP hash) |

## Explicit Inputs / Outputs

| Direction | What it is |
|-----------|-----------|
| **Input** | `AbuseEvent[]` — recent events with contributor ID, issue ref, kind, timestamp |
| **Input** | `Partial<AbuseDetectionPolicy>` — tunable thresholds |
| **Output** | `CoordinatedAbuseReport.patterns[]` — each detected cluster with contributors/issues |
| **Output** | `CoordinatedAbuseReport.overallRisk` — `low \| medium \| high \| critical` |
| **Output** | `CoordinatedAbuseReport.requiresHumanReview` — always true when risk > low |

## Review Boundary

The service **never writes to the database, bans contributors, or changes appeal
state.** Every `requiresHumanReview=true` report must be inspected by an operator
before any consequence is applied. Automated punishment is explicitly excluded.

## Measurability and Tuning

All thresholds live in `AbuseDetectionPolicy` (default exported as
`DEFAULT_ABUSE_DETECTION_POLICY`). Operators can change any value at runtime by
passing `Partial<AbuseDetectionPolicy>` to `analyse()` — no code change needed.

Internal `_signalStrength` scores (0–100) drive `overallRisk` but are stripped
from the public `CoordinatedAbuseReportResponse` contract so contributors never
see detection internals.

## File Location

`apps/api/src/modules/wave/coordinated-abuse-detection.service.ts`
