/**
 * Extract the fields needed to re-populate ContractCallForm from a
 * historical transaction entry. (#916)
 */
export interface HistoricalTransaction {
  contractId: string;
  functionName: string;
  args: Record<string, unknown>;
}

export interface ReplayFormValues {
  contractId: string;
  functionName: string;
  args: Record<string, unknown>;
  focusSimulate: true;
}

export function buildReplayFormValues(tx: HistoricalTransaction): ReplayFormValues {
  return {
    contractId: tx.contractId,
    functionName: tx.functionName,
    args: { ...tx.args },
    focusSimulate: true,
  };
}
