import type { DeploymentLogEntry } from "@/store/useDeploymentLogStore";

export interface RollbackTarget {
  /** The deployment currently live for the contract. */
  current: DeploymentLogEntry;
  /** The deployment that a rollback would restore. */
  previous: DeploymentLogEntry;
}

/**
 * Finds the deployment to roll back to: the most recent successful
 * deployment of `contractId` before the current one, with a different WASM
 * hash. Entries are expected newest-first, as the store keeps them.
 */
export function findRollbackTarget(
  entries: DeploymentLogEntry[],
  contractId: string,
): RollbackTarget | null {
  const history = entries.filter((e) => e.status === "success" && e.contractId === contractId);
  const current = history[0];
  if (!current) return null;
  const previous = history.slice(1).find((e) => e.wasmHash !== current.wasmHash);
  return previous ? { current, previous } : null;
}

export interface RollbackSummaryRow {
  label: string;
  current: string;
  previous: string;
  changed: boolean;
}

/** Rows for the confirmation dialog: what changes if the rollback is applied. */
export function summarizeRollback({ current, previous }: RollbackTarget): RollbackSummaryRow[] {
  const row = (label: string, c: string, p: string): RollbackSummaryRow => ({
    label,
    current: c,
    previous: p,
    changed: c !== p,
  });
  return [
    row("WASM hash", current.wasmHash, previous.wasmHash),
    row("File", current.wasmFileName, previous.wasmFileName),
    row("Deployed", new Date(current.timestamp).toISOString(), new Date(previous.timestamp).toISOString()),
    row("Network", current.network, previous.network),
  ];
}
