#!/usr/bin/env tsx
/**
 * AI-204: Evaluator harness for appeal-model experiments.
 *
 * Replays historical or synthetic appeal cases against different prompt
 * configurations and model versions without touching live contributor state.
 * All evaluation is read-only and deterministic.
 *
 * Usage:
 *   tsx scripts/appeal-eval-harness.ts [--cases <path>] [--model <version>] [--out <path>]
 *
 * Options:
 *   --cases  Path to a JSON file containing AppealEvalCase[]  (default: built-in fixtures)
 *   --model  Model version label for result attribution        (default: "rules-v1")
 *   --out    Write JSON results to this path instead of stdout
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let casesPath: string | undefined;
let modelVersion = "rules-v1";
let outPath: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--cases" && args[i + 1]) casesPath = path.resolve(args[++i]);
  if (args[i] === "--model" && args[i + 1]) modelVersion = args[++i];
  if (args[i] === "--out" && args[i + 1]) outPath = path.resolve(args[++i]);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type EvalOutcome = "approved" | "rejected" | "escalated";
export type EvalLabel = "correct" | "incorrect" | "uncertain";

export interface AppealEvalCase {
  id: string;
  description: string;
  /** Ground-truth label set by a human reviewer */
  expectedOutcome: EvalOutcome;
  evidencePack: {
    issueRef: string;
    appealReason: string;
    reviewSummary: {
      totalReviews: number;
      approvalCount: number;
      changesRequestedCount: number;
      totalComments: number;
      latestMergeStatus: string;
    };
    priorDecisions: Array<{ outcome: EvalOutcome; humanOverride: boolean }>;
    workflowContext: Record<string, unknown> | null;
  };
}

export interface EvalResult {
  caseId: string;
  modelVersion: string;
  predictedOutcome: EvalOutcome;
  confidence: "high" | "medium" | "low";
  label: EvalLabel;
  reasoning: string;
  evaluatedAt: string;
}

export interface EvalReport {
  modelVersion: string;
  totalCases: number;
  correct: number;
  incorrect: number;
  uncertain: number;
  accuracy: number;
  escalationRate: number;
  results: EvalResult[];
  generatedAt: string;
}

// ── Deterministic rule-based evaluator ───────────────────────────────────────
// This is intentionally explicit so behavior is measurable and safe to tune.

function evaluate(c: AppealEvalCase, model: string): EvalResult {
  const { reviewSummary: rs, priorDecisions, appealReason } = c.evidencePack;
  const now = new Date().toISOString();

  // Escalate if there is conflicting human override history
  const hasHumanOverride = priorDecisions.some((d) => d.humanOverride);
  if (hasHumanOverride) {
    return {
      caseId: c.id,
      modelVersion: model,
      predictedOutcome: "escalated",
      confidence: "high",
      label: c.expectedOutcome === "escalated" ? "correct" : "incorrect",
      reasoning: "Prior human override detected — escalate for human review.",
      evaluatedAt: now,
    };
  }

  // Strong approval signal: multiple approvals, no changes requested, PR merged
  if (
    rs.approvalCount >= 2 &&
    rs.changesRequestedCount === 0 &&
    rs.latestMergeStatus === "merged"
  ) {
    const outcome: EvalOutcome = "approved";
    return {
      caseId: c.id,
      modelVersion: model,
      predictedOutcome: outcome,
      confidence: "high",
      label: c.expectedOutcome === outcome ? "correct" : "incorrect",
      reasoning: "≥2 approvals, 0 change requests, PR merged → approve.",
      evaluatedAt: now,
    };
  }

  // Clear rejection: no approvals, multiple change requests, PR closed
  if (
    rs.approvalCount === 0 &&
    rs.changesRequestedCount >= 2 &&
    rs.latestMergeStatus === "closed"
  ) {
    const outcome: EvalOutcome = "rejected";
    return {
      caseId: c.id,
      modelVersion: model,
      predictedOutcome: outcome,
      confidence: "high",
      label: c.expectedOutcome === outcome ? "correct" : "incorrect",
      reasoning: "0 approvals, ≥2 change requests, PR closed → reject.",
      evaluatedAt: now,
    };
  }

  // Vague reason with borderline signals → low confidence, escalate
  const vagueReasonKeywords = ["unfair", "mistake", "error", "wrong"];
  const reasonLower = appealReason.toLowerCase();
  const isVague = vagueReasonKeywords.some((kw) => reasonLower.includes(kw)) && appealReason.length < 80;

  if (isVague || rs.totalReviews === 0) {
    return {
      caseId: c.id,
      modelVersion: model,
      predictedOutcome: "escalated",
      confidence: "low",
      label: c.expectedOutcome === "escalated" ? "correct" : "uncertain",
      reasoning: "Insufficient evidence or vague appeal reason — escalate for human review.",
      evaluatedAt: now,
    };
  }

  // Default: approve when at least one approval and no strong rejection signal
  const outcome: EvalOutcome = rs.approvalCount >= 1 ? "approved" : "escalated";
  return {
    caseId: c.id,
    modelVersion: model,
    predictedOutcome: outcome,
    confidence: "medium",
    label: c.expectedOutcome === outcome ? "correct" : "uncertain",
    reasoning: `Borderline case: ${rs.approvalCount} approval(s), ${rs.changesRequestedCount} change request(s).`,
    evaluatedAt: now,
  };
}

// ── Built-in fixture cases ────────────────────────────────────────────────────

const FIXTURE_CASES: AppealEvalCase[] = [
  {
    id: "case-approved-clear",
    description: "Clearly valid appeal: merged PR with multiple approvals",
    expectedOutcome: "approved",
    evidencePack: {
      issueRef: "org/repo#101",
      appealReason: "My PR was approved and merged but the wave points were not credited.",
      reviewSummary: {
        totalReviews: 3,
        approvalCount: 2,
        changesRequestedCount: 0,
        totalComments: 4,
        latestMergeStatus: "merged",
      },
      priorDecisions: [],
      workflowContext: null,
    },
  },
  {
    id: "case-rejected-clear",
    description: "Clearly invalid appeal: closed PR with no approvals",
    expectedOutcome: "rejected",
    evidencePack: {
      issueRef: "org/repo#102",
      appealReason: "I submitted the PR but it was never reviewed fairly.",
      reviewSummary: {
        totalReviews: 2,
        approvalCount: 0,
        changesRequestedCount: 3,
        totalComments: 7,
        latestMergeStatus: "closed",
      },
      priorDecisions: [],
      workflowContext: null,
    },
  },
  {
    id: "case-escalated-human-override",
    description: "Prior human override — must be escalated regardless of signals",
    expectedOutcome: "escalated",
    evidencePack: {
      issueRef: "org/repo#103",
      appealReason: "I believe the original decision was incorrect.",
      reviewSummary: {
        totalReviews: 2,
        approvalCount: 1,
        changesRequestedCount: 1,
        totalComments: 2,
        latestMergeStatus: "merged",
      },
      priorDecisions: [{ outcome: "rejected", humanOverride: true }],
      workflowContext: null,
    },
  },
  {
    id: "case-escalated-vague",
    description: "Vague short reason with no strong review signal",
    expectedOutcome: "escalated",
    evidencePack: {
      issueRef: "org/repo#104",
      appealReason: "This is wrong",
      reviewSummary: {
        totalReviews: 0,
        approvalCount: 0,
        changesRequestedCount: 0,
        totalComments: 0,
        latestMergeStatus: "open",
      },
      priorDecisions: [],
      workflowContext: null,
    },
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

const cases: AppealEvalCase[] = casesPath
  ? (JSON.parse(fs.readFileSync(casesPath, "utf8")) as AppealEvalCase[])
  : FIXTURE_CASES;

console.log(`\n🧪  Appeal Evaluator Harness  [model=${modelVersion}]\n`);
console.log(`Running ${cases.length} case(s)...\n`);

const results: EvalResult[] = cases.map((c) => evaluate(c, modelVersion));

const correct = results.filter((r) => r.label === "correct").length;
const incorrect = results.filter((r) => r.label === "incorrect").length;
const uncertain = results.filter((r) => r.label === "uncertain").length;
const escalated = results.filter((r) => r.predictedOutcome === "escalated").length;

const report: EvalReport = {
  modelVersion,
  totalCases: cases.length,
  correct,
  incorrect,
  uncertain,
  accuracy: cases.length > 0 ? correct / cases.length : 0,
  escalationRate: cases.length > 0 ? escalated / cases.length : 0,
  results,
  generatedAt: new Date().toISOString(),
};

// Print per-case summary
for (const r of results) {
  const icon = r.label === "correct" ? "✅" : r.label === "incorrect" ? "❌" : "⚠️ ";
  console.log(`  ${icon}  [${r.caseId}]  predicted=${r.predictedOutcome}  confidence=${r.confidence}`);
  console.log(`       ${r.reasoning}`);
}

console.log(`\n── Summary ──────────────────────────────────────────`);
console.log(`  Total cases  : ${report.totalCases}`);
console.log(`  Correct      : ${correct}`);
console.log(`  Incorrect    : ${incorrect}`);
console.log(`  Uncertain    : ${uncertain}`);
console.log(`  Accuracy     : ${(report.accuracy * 100).toFixed(1)}%`);
console.log(`  Escalation % : ${(report.escalationRate * 100).toFixed(1)}%`);

if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report written to: ${outPath}`);
}

console.log();
