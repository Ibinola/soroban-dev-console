# AI-209: Model Rollback and Safe Rollout Controls for Appeal Automation

## Overview

`ModelRolloutService` provides a lightweight, in-process rollout controller with
three operating modes. AI behaviour can be pinned at a stable version, promoted
to full traffic, or gradually canary'd — and rolled back in one API call.

## Rollout Modes

| Mode | Behaviour |
|------|-----------|
| `pinned` | All requests use `stableVersion`. Safe baseline; no candidate exposure. |
| `canary` | `canaryPercent`% of requests use `activeVersion`; rest use `stableVersion`. Deterministic per `requestId`. |
| `full` | All requests use `activeVersion`. Only after canary validation. |

## Rollback

```
modelRolloutService.rollback()
```

Restores the previous `RolloutConfig` instantly. The service stores exactly one
level of previous config so a single call always undoes the last `setRollout`.
Rollback is a no-op if there is no previous config.

## Explicit Inputs / Outputs

| Direction | What it is |
|-----------|-----------|
| **Input** | `setRollout(config: RolloutConfig)` — operator sets mode, versions, canary% |
| **Input** | `resolveModel(requestId)` — per-request routing decision |
| **Output** | `RolloutResolution.modelVersion` — which version to use |
| **Output** | `RolloutResolution.reason` — human-readable routing explanation |
| **Output** | `ModelRolloutState` — current + previous config with timestamp |

## Review Boundary

Canary mode is the human review gate. Promote from `canary` → `full` only after:

1. Reviewing divergence logs from `ShadowModeService` (AI-208).
2. Confirming fairness metrics are stable.
3. No increase in human override rate (from `AppealDecisionsService.humanOverride` flag).

## Measurability

Every `setRollout` and `rollback` emits a structured log event
(`rollout_config_updated`, `rollout_rolled_back`) for metric pipelines and
operator audit.

## File Location

`apps/api/src/modules/appeal-decisions/model-rollout.service.ts`
