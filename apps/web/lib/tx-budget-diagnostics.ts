/**
 * Explain a Soroban transaction failure caused by exceeding CPU or
 * memory budget limits. (#910)
 */
export interface BudgetDiagnostic {
  cpuUsed: number;
  cpuLimit: number;
  memUsed: number;
  memLimit: number;
  cpuExceeded: boolean;
  memExceeded: boolean;
  guidance: string;
}

export function parseBudgetExceededError(
  cpuUsed: number,
  cpuLimit: number,
  memUsed: number,
  memLimit: number,
): BudgetDiagnostic {
  const cpuExceeded = cpuUsed > cpuLimit;
  const memExceeded = memUsed > memLimit;

  const guidance = cpuExceeded
    ? "CPU instruction limit exceeded — optimize loops or reduce contract call depth."
    : memExceeded
      ? "Memory budget exceeded — reduce large in-memory allocations or footprint size."
      : "Consider increasing the resource footprint for this invocation.";

  return { cpuUsed, cpuLimit, memUsed, memLimit, cpuExceeded, memExceeded, guidance };
}
