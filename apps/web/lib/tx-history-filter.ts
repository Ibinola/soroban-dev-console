/**
 * Filter and search the workspace transaction feed. (#911)
 */
export type TxFeedStatus = "success" | "failed" | "pending";

export interface FeedTransaction {
  hash: string;
  contractId: string;
  status: TxFeedStatus;
}

export function filterTransactionsByStatus(
  transactions: FeedTransaction[],
  status: TxFeedStatus | "all",
): FeedTransaction[] {
  if (status === "all") return transactions;
  return transactions.filter((tx) => tx.status === status);
}

export function searchTransactions(transactions: FeedTransaction[], query: string): FeedTransaction[] {
  const lowerQuery = query.toLowerCase();
  return transactions.filter(
    (tx) => tx.hash.toLowerCase().includes(lowerQuery) || tx.contractId.toLowerCase().includes(lowerQuery),
  );
}

export function countByStatus(transactions: FeedTransaction[]): Record<TxFeedStatus, number> {
  return {
    success: transactions.filter((t) => t.status === "success").length,
    failed: transactions.filter((t) => t.status === "failed").length,
    pending: transactions.filter((t) => t.status === "pending").length,
  };
}
