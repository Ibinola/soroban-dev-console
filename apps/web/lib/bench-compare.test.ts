import { describe, expect, it } from "vitest";
import {
  baselineFromReport,
  compareToBaseline,
  formatComparison,
  median,
  type BenchResult,
} from "../../../packages/soroban-utils/bench/compare";

const result = (relative: number): BenchResult => ({ medianMs: relative, relative, iterations: 1 });

describe("benchmark comparison (#1306)", () => {
  it("computes medians", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
  });

  it("passes when results are within the 20% threshold", () => {
    const { comparisons, failed } = compareToBaseline(
      { results: { a: result(1.19), b: result(0.9) } },
      { schemaVersion: 1, relative: { a: 1, b: 1 } },
    );
    expect(failed).toBe(false);
    expect(comparisons.map((c) => c.status)).toEqual(["ok", "ok"]);
  });

  it("fails when a benchmark exceeds the baseline by more than 20%", () => {
    const { comparisons, failed } = compareToBaseline(
      { results: { a: result(1.21) } },
      { schemaVersion: 1, relative: { a: 1 } },
    );
    expect(failed).toBe(true);
    expect(comparisons[0]).toMatchObject({ name: "a", status: "regression" });
    expect(comparisons[0].change).toBeCloseTo(0.21);
  });

  it("honours a custom threshold", () => {
    const report = { results: { a: result(1.3) } };
    const baseline = { schemaVersion: 1 as const, relative: { a: 1 } };
    expect(compareToBaseline(report, baseline, 0.5).failed).toBe(false);
    expect(compareToBaseline(report, baseline, 0.1).failed).toBe(true);
  });

  it("reports improvements, new benchmarks and missing ones without failing", () => {
    const { comparisons, failed } = compareToBaseline(
      { results: { fast: result(0.5), fresh: result(2) } },
      { schemaVersion: 1, relative: { fast: 1, gone: 1 } },
    );
    expect(failed).toBe(false);
    expect(Object.fromEntries(comparisons.map((c) => [c.name, c.status]))).toEqual({
      fast: "improved",
      fresh: "new",
      gone: "missing",
    });
  });

  it("builds a baseline from a report", () => {
    expect(baselineFromReport({ results: { a: result(1.23456789) } })).toEqual({
      schemaVersion: 1,
      relative: { a: 1.235 },
    });
  });

  it("formats comparison lines", () => {
    expect(formatComparison({ name: "x", status: "regression", baseline: 1, current: 1.5, change: 0.5 })).toBe(
      "REGRESSION x (+50.0%)",
    );
    expect(formatComparison({ name: "y", status: "new", current: 1 })).toBe("new        y");
  });
});
