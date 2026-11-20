import { xdr } from "@stellar/stellar-sdk";

/**
 * Decode a SorobanAuthorizationEntry into a human-readable summary. (#930)
 */
export interface AuthEntrySummary {
  contractId: string | undefined;
  functionName: string | undefined;
  argCount: number;
}

export function inspectAuthorizationEntry(base64: string): AuthEntrySummary {
  const entry = xdr.SorobanAuthorizationEntry.fromXDR(base64, "base64");
  const rootInvocation = entry.rootInvocation();
  const fn = rootInvocation.function();

  const contractFn = fn.contractFn ? fn.contractFn() : undefined;

  return {
    contractId: contractFn?.contractAddress().contractId().toString("hex"),
    functionName: contractFn?.functionName().toString(),
    argCount: contractFn?.args().length ?? 0,
  };
}
