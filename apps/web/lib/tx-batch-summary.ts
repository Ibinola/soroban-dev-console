/**
 * Summarize a finished batch invocation queue into pass/fail statistics. (#918)
 */
export interface BatchCallResult {
  success: boolean;
  durationMs: number;
  feeStroops: number;
}

export interface BatchSummary {
  total: number;
  succeeded: number;
  failed: number;
  totalDurationMs: number;
  totalFeeStroops: number;
  failedIndexes: number[];
}

export function summarizeBatchResults(results: BatchCallResult[]): BatchSummary {
  const failedIndexes = results
    .map((r, i) => (r.success ? -1 : i))
    .filter((i) => i !== -1);

  return {
    total: results.length,
    succeeded: results.filter((r) => r.success).length,
    failed: failedIndexes.length,
    totalDurationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
    totalFeeStroops: results.reduce((sum, r) => sum + r.feeStroops, 0),
    failedIndexes,
  };
}
