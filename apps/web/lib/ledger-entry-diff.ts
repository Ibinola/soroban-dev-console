/**
 * Diff ledger entry changes from a transaction's resultMetaXdr changes
 * array into created/modified/deleted buckets. (#908)
 */
export interface LedgerEntryChange {
  type: "created" | "updated" | "removed" | "state";
  key: string;
}

export interface LedgerEntryDiff {
  created: string[];
  modified: string[];
  deleted: string[];
}

export function diffLedgerEntryChanges(changes: LedgerEntryChange[]): LedgerEntryDiff {
  const created: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  for (const change of changes) {
    if (change.type === "created") created.push(change.key);
    else if (change.type === "updated") modified.push(change.key);
    else if (change.type === "removed") deleted.push(change.key);
  }

  return { created, modified, deleted };
}
