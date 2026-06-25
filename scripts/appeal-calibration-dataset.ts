#!/usr/bin/env tsx
/**
 * AI-205: Labeled calibration dataset for appeal quality and fairness.
 *
 * Builds and maintains a dataset capturing accepted, rejected, overridden, and
 * ambiguous appeal cases so the AI system can be calibrated against real decision
 * patterns. The dataset is written as newline-delimited JSON (NDJSON) so it can
 * be consumed by offline tools, notebooks, or the eval harness.
 *
 * Usage:
 *   tsx scripts/appeal-calibration-dataset.ts [--out <path>] [--format json|ndjson]
 *
 * Options:
 *   --out     Output file path  (default: docs/appeal-calibration-dataset.ndjson)
 *   --format  json | ndjson     (default: ndjson)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
let outPath = path.join(ROOT, "docs/appeal-calibration-dataset.ndjson");
let format: "json" | "ndjson" = "ndjson";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out" && args[i + 1]) outPath = path.resolve(args[++i]);
  if (args[i] === "--format" && (args[i + 1] === "json" || args[i + 1] === "ndjson")) {
    format = args[++i] as "json" | "ndjson";
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type CalibrationLabel =
  | "approved"        // clear valid appeal — should be approved
  | "rejected"        // clear invalid appeal — should be rejected
  | "escalated"       // ambiguous — requires human review
  | "overridden"      // model was wrong; human reversed the decision
  | "ambiguous";      // genuine grey area, useful for boundary calibration

export interface CalibrationEntry {
  id: string;
  label: CalibrationLabel;
  /** Free-text note explaining why this label was assigned */
  rationale: string;
  /** Source of this entry: "synthetic" | "production" | "replay" */
  source: "synthetic" | "production" | "replay";
  addedAt: string;
  evidencePack: {
    issueRef: string;
    appealReason: string;
    reviewSummary: {
      totalReviews: number;
      approvalCount: number;
      changesRequestedCount: number;
      totalComments: number;
      latestMergeStatus: "open" | "merged" | "closed" | "unknown";
    };
    priorDecisions: Array<{ outcome: string; humanOverride: boolean }>;
    workflowContext: Record<string, unknown> | null;
  };
}

// ── Seed dataset ──────────────────────────────────────────────────────────────

const ENTRIES: CalibrationEntry[] = [
  {
    id: "cal-001",
    label: "approved",
    rationale: "PR merged with 2 approvals, 0 change requests, well-documented reason.",
    source: "synthetic",
    addedAt: "2026-01-10T00:00:00.000Z",
    evidencePack: {
      issueRef: "org/repo#201",
      appealReason:
        "My PR was approved by two maintainers and merged but the wave points were never credited.",
      reviewSummary: {
        totalReviews: 3,
        approvalCount: 2,
        changesRequestedCount: 0,
        totalComments: 5,
        latestMergeStatus: "merged",
      },
      priorDecisions: [],
      workflowContext: { waveId: "wave-5", expectedPoints: 100 },
    },
  },
  {
    id: "cal-002",
    label: "rejected",
    rationale: "PR closed with no approvals and multiple change requests; appeal reason is generic.",
    source: "synthetic",
    addedAt: "2026-01-10T00:00:00.000Z",
    evidencePack: {
      issueRef: "org/repo#202",
      appealReason: "I feel the review was unfair.",
      reviewSummary: {
        totalReviews: 2,
        approvalCount: 0,
        changesRequestedCount: 3,
        totalComments: 9,
        latestMergeStatus: "closed",
      },
      priorDecisions: [],
      workflowContext: null,
    },
  },
  {
    id: "cal-003",
    label: "overridden",
    rationale:
      "Model initially rejected but maintainer overrode to approved after reviewing diff manually.",
    source: "replay",
    addedAt: "2026-02-15T00:00:00.000Z",
    evidencePack: {
      issueRef: "org/repo#203",
      appealReason:
        "The automated system missed that the second reviewer approved after requesting changes.",
      reviewSummary: {
        totalReviews: 4,
        approvalCount: 1,
        changesRequestedCount: 2,
        totalComments: 12,
        latestMergeStatus: "merged",
      },
      priorDecisions: [{ outcome: "rejected", humanOverride: true }],
      workflowContext: { reviewTimingAnomalyFlag: true },
    },
  },
  {
    id: "cal-004",
    label: "escalated",
    rationale: "No review context found; appeal timing is within policy but evidence is thin.",
    source: "synthetic",
    addedAt: "2026-02-20T00:00:00.000Z",
    evidencePack: {
      issueRef: "org/repo#204",
      appealReason: "The review window passed without my PR being reviewed.",
      reviewSummary: {
        totalReviews: 0,
        approvalCount: 0,
        changesRequestedCount: 0,
        totalComments: 0,
        latestMergeStatus: "open",
      },
      priorDecisions: [],
      workflowContext: { timeSinceSubmissionHours: 72, reviewWindowHours: 48 },
    },
  },
  {
    id: "cal-005",
    label: "ambiguous",
    rationale:
      "One approval and one change request; PR merged after conflict resolution. Boundary case for tuning.",
    source: "production",
    addedAt: "2026-03-05T00:00:00.000Z",
    evidencePack: {
      issueRef: "org/repo#205",
      appealReason:
        "The change request was addressed and resolved before merge but points were withheld.",
      reviewSummary: {
        totalReviews: 2,
        approvalCount: 1,
        changesRequestedCount: 1,
        totalComments: 6,
        latestMergeStatus: "merged",
      },
      priorDecisions: [],
      workflowContext: { changeRequestResolvedBeforeMerge: true },
    },
  },
  {
    id: "cal-006",
    label: "approved",
    rationale: "Budget reservation was cancelled due to cap exhaustion; contributor was verified before cancellation.",
    source: "replay",
    addedAt: "2026-03-10T00:00:00.000Z",
    evidencePack: {
      issueRef: "org/repo#206",
      appealReason:
        "My reservation was cancelled due to budget pressure even though I was already verified.",
      reviewSummary: {
        totalReviews: 1,
        approvalCount: 1,
        changesRequestedCount: 0,
        totalComments: 2,
        latestMergeStatus: "merged",
      },
      priorDecisions: [],
      workflowContext: {
        budgetCapExhaustedAtCancellation: true,
        contributorVerifiedBeforeReservation: true,
      },
    },
  },
  {
    id: "cal-007",
    label: "rejected",
    rationale: "Duplicate submission pattern detected; two accounts submitted the same issue ref.",
    source: "synthetic",
    addedAt: "2026-04-01T00:00:00.000Z",
    evidencePack: {
      issueRef: "org/repo#207",
      appealReason: "I submitted this issue first.",
      reviewSummary: {
        totalReviews: 1,
        approvalCount: 0,
        changesRequestedCount: 1,
        totalComments: 1,
        latestMergeStatus: "closed",
      },
      priorDecisions: [],
      workflowContext: { duplicateSubmissionDetected: true, duplicateAccountCount: 2 },
    },
  },
  {
    id: "cal-008",
    label: "escalated",
    rationale: "Human override history exists but reason for original override is undocumented.",
    source: "production",
    addedAt: "2026-04-15T00:00:00.000Z",
    evidencePack: {
      issueRef: "org/repo#208",
      appealReason: "A previous decision was reversed but I still haven't received points.",
      reviewSummary: {
        totalReviews: 3,
        approvalCount: 2,
        changesRequestedCount: 0,
        totalComments: 3,
        latestMergeStatus: "merged",
      },
      priorDecisions: [
        { outcome: "rejected", humanOverride: false },
        { outcome: "approved", humanOverride: true },
      ],
      workflowContext: null,
    },
  },
];

// ── Write output ──────────────────────────────────────────────────────────────

const dir = path.dirname(outPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

if (format === "ndjson") {
  fs.writeFileSync(outPath, ENTRIES.map((e) => JSON.stringify(e)).join("\n") + "\n");
} else {
  fs.writeFileSync(outPath, JSON.stringify(ENTRIES, null, 2) + "\n");
}

console.log(`\n📊  Appeal Calibration Dataset\n`);
console.log(`  Entries  : ${ENTRIES.length}`);

const byLabel: Record<string, number> = {};
for (const e of ENTRIES) byLabel[e.label] = (byLabel[e.label] ?? 0) + 1;
for (const [label, count] of Object.entries(byLabel)) {
  console.log(`  ${label.padEnd(12)}: ${count}`);
}

console.log(`\n  Format   : ${format}`);
console.log(`  Written  : ${outPath}\n`);
