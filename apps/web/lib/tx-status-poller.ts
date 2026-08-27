/**
 * Poll a transaction status endpoint with exponential backoff. (#909)
 */
export type TxStatus = "SUCCESS" | "FAILED" | "NOT_FOUND";

export interface PollOptions {
  initialDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
}

export async function pollTransactionStatus(
  fetchStatus: () => Promise<TxStatus>,
  options: PollOptions = {},
): Promise<TxStatus | "TIMEOUT"> {
  const { initialDelayMs = 1000, maxDelayMs = 10000, timeoutMs = 60000 } = options;
  const start = Date.now();
  let delay = initialDelayMs;

  for (;;) {
    const status = await fetchStatus();
    if (status === "SUCCESS" || status === "FAILED") {
      return status;
    }
    if (Date.now() - start >= timeoutMs) {
      return "TIMEOUT";
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, maxDelayMs);
  }
}
