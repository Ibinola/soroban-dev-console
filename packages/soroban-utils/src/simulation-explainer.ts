export interface SimulationFeeBreakdown {
  inclusionFee: string;
  resourceFee: string;
  totalFee: string;
}

export interface SimulationAuthEntry {
  contractId: string;
  fnName: string;
}

export interface SimulationExplanation {
  success: boolean;
  fees: SimulationFeeBreakdown;
  authEntries: SimulationAuthEntry[];
  stateChanges: string[];
  outputSummary: string;
  warnings: string[];
}

type RawSimResult = {
  error?: string;
  result?: { retval?: unknown };
  cost?: { cpuInsns?: string; memBytes?: string };
  minResourceFee?: string;
  transactionData?: {
    resources?: {
      footprint?: {
        readOnly?: unknown[];
        readWrite?: unknown[];
      };
    };
  };
  auth?: Array<{ rootInvocation?: { functionName?: string; contractAddress?: string } }>;
};

/**
 * Transforms a raw Soroban simulation result into a developer-friendly
 * explanation covering fees, auth requirements, state implications, and output.
 */
export function explainSimulation(raw: RawSimResult): SimulationExplanation {
  const warnings: string[] = [];

  if (raw.error) {
    warnings.push(`Simulation failed: ${raw.error}`);
    return {
      success: false,
      fees: { inclusionFee: "n/a", resourceFee: "n/a", totalFee: "n/a" },
      authEntries: [],
      stateChanges: [],
      outputSummary: `Error: ${raw.error}`,
      warnings,
    };
  }

  const resourceFee = raw.minResourceFee ?? "0";
  const inclusionFee = "100"; // base inclusion fee in stroops
  const totalFee = (
    parseInt(inclusionFee, 10) + parseInt(resourceFee, 10)
  ).toString();

  const authEntries: SimulationAuthEntry[] = (raw.auth ?? []).map((a) => ({
    contractId: a.rootInvocation?.contractAddress ?? "unknown",
    fnName: a.rootInvocation?.functionName ?? "unknown",
  }));

  const readOnly = raw.transactionData?.resources?.footprint?.readOnly ?? [];
  const readWrite = raw.transactionData?.resources?.footprint?.readWrite ?? [];
  const stateChanges: string[] = [];
  if ((readOnly as unknown[]).length > 0)
    stateChanges.push(`${(readOnly as unknown[]).length} ledger key(s) read`);
  if ((readWrite as unknown[]).length > 0)
    stateChanges.push(`${(readWrite as unknown[]).length} ledger key(s) written`);

  if (authEntries.length === 0) warnings.push("No auth entries — ensure callers are set.");
  if (parseInt(resourceFee, 10) > 100_000)
    warnings.push("Resource fee is unusually high — consider optimising storage footprint.");

  const outputSummary =
    raw.result?.retval !== undefined
      ? `Return value: ${JSON.stringify(raw.result.retval)}`
      : "No return value (void function).";

  return {
    success: true,
    fees: { inclusionFee, resourceFee, totalFee },
    authEntries,
    stateChanges,
    outputSummary,
    warnings,
  };
}
