/**
 * Compare simulated vs actual on-chain resource consumption. (#922)
 */
export type EfficiencyRating = "Optimal" | "Near-limit" | "Over-budget";

export interface BenchmarkResult {
  cpuVariancePct: number;
  memVariancePct: number;
  rating: EfficiencyRating;
  suggestOptimization: boolean;
}

export function computeBenchmark(
  simulatedCpu: number,
  actualCpu: number,
  simulatedMem: number,
  actualMem: number,
): BenchmarkResult {
  const cpuVariancePct = simulatedCpu === 0 ? 0 : ((actualCpu - simulatedCpu) / simulatedCpu) * 100;
  const memVariancePct = simulatedMem === 0 ? 0 : ((actualMem - simulatedMem) / simulatedMem) * 100;
  const maxVariance = Math.max(Math.abs(cpuVariancePct), Math.abs(memVariancePct));

  const rating: EfficiencyRating =
    maxVariance > 20 ? "Over-budget" : maxVariance > 10 ? "Near-limit" : "Optimal";

  return {
    cpuVariancePct: Math.round(cpuVariancePct * 100) / 100,
    memVariancePct: Math.round(memVariancePct * 100) / 100,
    rating,
    suggestOptimization: maxVariance > 20,
  };
}
