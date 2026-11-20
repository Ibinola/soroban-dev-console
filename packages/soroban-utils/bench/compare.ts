/**
 * Pure helpers for the soroban-utils benchmark suite: statistics and the
 * comparison against the stored baseline. No I/O so they are unit-testable.
 */

export const DEFAULT_THRESHOLD = 0.2;

export interface BenchResult {
  /** Median milliseconds per operation. */
  medianMs: number;
  /** Median cost relative to the calibration workload (machine independent). */
  relative: number;
  iterations: number;
}

export interface BenchReport {
  schemaVersion: 1;
  generatedAt: string;
  node: string;
  /** Median ms per operation of the fixed calibration workload on this machine. */
  calibrationMs: number;
  results: Record<string, BenchResult>;
}

export interface Baseline {
  schemaVersion: 1;
  /** Relative cost per benchmark, as recorded by `--update-baseline`. */
  relative: Record<string, number>;
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type ComparisonStatus = "ok" | "regression" | "improved" | "new" | "missing";

export interface Comparison {
  name: string;
  status: ComparisonStatus;
  baseline?: number;
  current?: number;
  /** (current - baseline) / baseline, when both are known. */
  change?: number;
}

/**
 * Compares a report against the baseline. A benchmark regresses when its
 * relative cost exceeds the baseline by more than `threshold` (default 20%).
 * New benchmarks (no baseline yet) and baselines with no result are reported
 * but only a regression fails the run.
 */
export function compareToBaseline(
  report: Pick<BenchReport, "results">,
  baseline: Baseline,
  threshold: number = DEFAULT_THRESHOLD,
): { comparisons: Comparison[]; failed: boolean } {
  const comparisons: Comparison[] = [];
  for (const [name, result] of Object.entries(report.results)) {
    const base = baseline.relative[name];
    if (base === undefined) {
      comparisons.push({ name, status: "new", current: result.relative });
      continue;
    }
    const change = (result.relative - base) / base;
    comparisons.push({
      name,
      status: change > threshold ? "regression" : change < -threshold ? "improved" : "ok",
      baseline: base,
      current: result.relative,
      change,
    });
  }
  for (const name of Object.keys(baseline.relative)) {
    if (!(name in report.results)) comparisons.push({ name, status: "missing", baseline: baseline.relative[name] });
  }
  return { comparisons, failed: comparisons.some((c) => c.status === "regression") };
}

export function baselineFromReport(report: Pick<BenchReport, "results">): Baseline {
  const relative: Record<string, number> = {};
  for (const [name, r] of Object.entries(report.results)) relative[name] = Number(r.relative.toPrecision(4));
  return { schemaVersion: 1, relative };
}

export function formatComparison(c: Comparison): string {
  const pct = c.change === undefined ? "" : ` (${c.change >= 0 ? "+" : ""}${(c.change * 100).toFixed(1)}%)`;
  const tag = { ok: "ok", regression: "REGRESSION", improved: "improved", new: "new", missing: "missing" }[c.status];
  return `${tag.padEnd(10)} ${c.name}${pct}`;
}
