/**
 * Export workspace transaction history entries to a downloadable JSON
 * file for offline audit or bug reporting. (#912)
 */
export interface ExportableTxEntry {
  hash: string;
  timestamp: string;
  input: Record<string, unknown>;
  result: unknown;
}

export function buildExportFilename(workspace: string, date: Date = new Date()): string {
  const isoDate = date.toISOString().slice(0, 10);
  return `soroban-tx-history-${workspace}-${isoDate}.json`;
}

export function serializeTransactionHistory(entries: ExportableTxEntry[]): string {
  return JSON.stringify(entries, null, 2);
}
