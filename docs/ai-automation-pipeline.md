# AI Automation Pipeline

Covers issues AI-211 through AI-214. Four modules that add first-pass
classification, review summarization, budget exception recommendations,
and continuous model monitoring to the Soroban Dev Console API.

---

## Modules

### ticket-classifier (AI-211)

**Route:** `POST /ticket-classifier/classify`

Runs a rule-based classifier over an existing support ticket and writes a
`TicketClassification` record. Inputs are explicit: subject, body, category,
priority, and tags. Outputs are explicit: suggestedCategory, suggestedPriority,
suggestedRoute, confidence (0-1), and a signals breakdown.

Routes:
- `tier1-auto` -- high confidence, no human needed
- `tier1-human` -- moderate confidence, human reviews before acting
- `tier2-escalate` -- low confidence or complex signals
- `maintainer` -- appeal or dispute keywords detected
- `security` -- abuse, exploit, or compromise keywords detected

Human override: `PATCH /ticket-classifier/ticket/:ticketId/override`
Sets `humanOverride=true`, records who overrode and why. The original
model output is preserved in the signals field for audit.

Confidence formula (weights sum to 1.0):

    confidence = categoryWeight(0.35) + priorityWeight(0.35) + keywordBonus(0.20) + bodyLengthScore(0.10)

Model version: `rules-v1.0.0` -- bump the constant in the service when
rules change so snapshots remain attributable.

---

### review-summarizer (AI-212)

**Route:** `POST /review-summarizer/summarize`

Reads all `ReviewContext` records for a pull request and compresses them
into a `ReviewSummary` with a plain-text summaryText and a structured
keySignals object. Designed as input for human appeal triage, not as a
final decision.

Signals captured: reviewCount, approvalCount, approvalRatio,
totalComments, totalRequestedChanges, latestMergeStatus,
uniqueReviewers, conflictingDecisions.

Human override: `PATCH /review-summarizer/pr/:pullRequestId/override`
Allows a maintainer to substitute the generated summaryText and mark
the record as human-reviewed.

---

### budget-exception (AI-213)

**Route:** `POST /budget-exception/recommend`

Derives utilization, pacing, and concentration signals from
`OrganizationBudget` and `PointReservation` records, then recommends
one of: `review`, `no-review`, or `escalate`. Final decisions always
stay with a human via `PATCH /budget-exception/org/:organizationId/decide`.

Thresholds (tunable via constant):
- utilization >= 0.95 -> escalate (confidence 0.90)
- utilization >= 0.80 or highConcentration -> review (confidence 0.75)
- otherwise -> no-review (confidence 0.80)

Concentration flag: a single contributor holds >= 50% of all points
in the organization.

---

### ai-monitor (AI-214)

**Route:** `POST /ai-monitor/snapshot`

Records a point-in-time `AiMetricSnapshot`. Each snapshot is immutable.
Four metric types are tracked:

| Metric | Alert when | Threshold |
|---|---|---|
| override_rate | value > threshold | 0.25 |
| classification_precision | value < threshold | 0.70 |
| fairness_drift | value > threshold | 0.15 |
| queue_health | value < threshold | 0.50 |

`GET /ai-monitor/alerts` -- returns all snapshots where alertTriggered=true.
`GET /ai-monitor/summary` -- returns latest value per metric type.

For automated collection use `scripts/check-model-drift.ts`.

---

## Shared Design Constraints (all four modules)

1. **Explicit inputs and outputs.** Every module exposes its signals as
   a JSON column. Nothing is hidden inside opaque model weights.

2. **Measurable behavior.** Model version is stored on every record.
   Changing rules requires bumping the version constant so before/after
   comparisons are possible.

3. **Human override always available.** Every classification, summary,
   and recommendation has a dedicated override endpoint that records
   who overrode, when, and why. The original output is never deleted.

---

## Adding or Tuning Rules

- Ticket classifier: edit `KEYWORD_ROUTE_MAP`, `CATEGORY_WEIGHT`, and
  `PRIORITY_WEIGHT` in `ticket-classifier.service.ts`, then bump
  `CLASSIFIER_MODEL_VERSION`.
- Budget exception: edit `UTILIZATION_REVIEW_THRESHOLD`,
  `UTILIZATION_ESCALATE_THRESHOLD`, and `CONCENTRATION_RATIO` in
  `budget-exception.service.ts`, then bump `EXCEPTION_MODEL_VERSION`.
- Monitor alerts: edit `ALERT_THRESHOLDS` in `ai-monitor.service.ts`,
  then bump `MONITOR_MODEL_VERSION`.

---

## Related Docs

- `docs/review-routing.md` -- upstream routing conventions
- `docs/governance.md` -- override approval process
- `docs/observability.md` -- metric collection setup
