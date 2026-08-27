/**
 * Compare parameter payloads and execution results between two historical
 * transaction entries. (#920)
 */
export interface TxDiffEntry {
  latencyMs: number;
  feeCharged: number;
  args: Record<string, unknown>;
}

export interface PayloadDiffResult {
  changedArgs: string[];
  latencyDeltaMs: number;
  feeDeltaStroops: number;
}

export function diffTransactionPayloads(a: TxDiffEntry, b: TxDiffEntry): PayloadDiffResult {
  const allKeys = new Set([...Object.keys(a.args), ...Object.keys(b.args)]);
  const changedArgs = [...allKeys].filter(
    (key) => JSON.stringify(a.args[key]) !== JSON.stringify(b.args[key]),
  );

  return {
    changedArgs,
    latencyDeltaMs: b.latencyMs - a.latencyMs,
    feeDeltaStroops: b.feeCharged - a.feeCharged,
  };
}
