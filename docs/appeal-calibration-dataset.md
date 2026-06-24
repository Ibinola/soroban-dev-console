# Appeal Calibration Dataset

**AI-205** — Labeled dataset for appeal quality and fairness calibration.

## Purpose

This dataset captures accepted, rejected, overridden, and ambiguous appeal cases so the AI evaluation system can be calibrated against real decision patterns. Every entry pairs a structured evidence pack with a human-assigned ground-truth label.

## Labels

| Label | Meaning |
|---|---|
| `approved` | Clear valid appeal — evidence strongly supports approval |
| `rejected` | Clear invalid appeal — evidence supports rejection |
| `escalated` | Ambiguous — insufficient evidence, escalate to human reviewer |
| `overridden` | Model was wrong; a human reversed the decision |
| `ambiguous` | Genuine grey area — useful for boundary calibration |

## Sources

| Source | Meaning |
|---|---|
| `synthetic` | Hand-crafted fixture case |
| `production` | Sanitised from a real event (no PII) |
| `replay` | Reconstructed from a replay pack scenario |

## Files

| File | Description |
|---|---|
| `docs/appeal-calibration-dataset.ndjson` | Newline-delimited JSON — one entry per line |
| `scripts/appeal-calibration-dataset.ts` | Generator script — add entries here |

## Generating / updating

```bash
# (Re)generate the NDJSON file from the script entries
tsx scripts/appeal-calibration-dataset.ts

# Write as a pretty-printed JSON array instead
tsx scripts/appeal-calibration-dataset.ts --format json --out /tmp/dataset.json
```

## Using with the evaluator harness

The harness (`scripts/appeal-eval-harness.ts`) accepts an external cases file. The calibration dataset uses the same `evidencePack` shape, so you can run the harness directly against it:

```bash
# Convert NDJSON → JSON array first, then run the harness
node -e "
  const fs = require('fs');
  const lines = fs.readFileSync('docs/appeal-calibration-dataset.ndjson','utf8').trim().split('\n');
  const cases = lines.map(l => {
    const e = JSON.parse(l);
    return { id: e.id, description: e.rationale, expectedOutcome: e.label, evidencePack: e.evidencePack };
  });
  fs.writeFileSync('/tmp/cal-cases.json', JSON.stringify(cases, null, 2));
"
tsx scripts/appeal-eval-harness.ts --cases /tmp/cal-cases.json --model rules-v1
```

## Adding entries

1. Open `scripts/appeal-calibration-dataset.ts`.
2. Append a new `CalibrationEntry` to the `ENTRIES` array.
3. Set `source: "production"` only if the data has been sanitised (no real contributor IDs, issue refs, or emails).
4. Re-run the generator: `tsx scripts/appeal-calibration-dataset.ts`.
5. Commit both the updated script and the regenerated `.ndjson` file.

## Fairness guidelines

- Aim for balanced label distribution. If `approved` entries dominate, add `rejected` and `ambiguous` cases to prevent the evaluator from developing an approval bias.
- Include at least two `overridden` entries per wave cycle so the model's failure modes are visible.
- Review `ambiguous` entries periodically — if a human panel reaches consensus on the correct outcome, promote the entry to `approved` or `rejected` and document the reasoning.
