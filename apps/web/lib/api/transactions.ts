/**
 * BE-017: Normalized transaction status API client.
 *
 * Provides stable, normalized transaction status responses for simulation,
 * submission, and polling operations. Frontend consumers can rely on a
 * consistent contract without dealing with upstream RPC shape variations.
 */

import { DEFAULT_LOCAL_API_URL } from "@devconsole/api-contracts";
import {
  NormalizedTransactionResult,
  NormalizedSimulationPayload,
  ApiResponse,
} from "@devconsole/api-contracts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_LOCAL_API_URL;

export class TransactionApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "TransactionApiError";
  }
}

/**
 * Send a simulation request through the normalized API
 */
export async function simulateTransaction(
  network: string,
  transactionXdr: string,
): Promise<NormalizedSimulationPayload> {
  const response = await fetch(`${API_BASE}/api/rpc/${network}/simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transaction: transactionXdr }),
  });

  if (!response.ok) {
    throw new TransactionApiError(
      `Simulation API returned HTTP ${response.status}`,
      "HTTP_ERROR",
    );
  }

  const result = (await response.json()) as ApiResponse<NormalizedSimulationPayload>;

  if (!result.success) {
    throw new TransactionApiError(
      result.error.message,
      result.error.code,
      result.error.details,
    );
  }

  return result.data;
}

/**
 * Send a transaction through the normalized API
 */
export async function sendTransaction(
  network: string,
  transactionXdr: string,
): Promise<NormalizedTransactionResult> {
  const response = await fetch(`${API_BASE}/api/rpc/${network}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transaction: transactionXdr }),
  });

  if (!response.ok) {
    throw new TransactionApiError(
      `Send transaction API returned HTTP ${response.status}`,
      "HTTP_ERROR",
    );
  }

  const result = (await response.json()) as ApiResponse<NormalizedTransactionResult>;

  if (!result.success) {
    throw new TransactionApiError(
      result.error.message,
      result.error.code,
      result.error.details,
    );
  }

  return result.data;
}

/**
 * Get transaction status through the normalized API
 */
export async function getTransactionStatus(
  network: string,
  hash: string,
): Promise<NormalizedTransactionResult> {
  const response = await fetch(`${API_BASE}/api/rpc/${network}/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ hash }),
  });

  if (!response.ok) {
    throw new TransactionApiError(
      `Transaction status API returned HTTP ${response.status}`,
      "HTTP_ERROR",
    );
  }

  const result = (await response.json()) as ApiResponse<NormalizedTransactionResult>;

  if (!result.success) {
    throw new TransactionApiError(
      result.error.message,
      result.error.code,
      result.error.details,
    );
  }

  return result.data;
}

/**
 * Poll transaction status until completion or timeout
 */
export async function pollTransactionStatus(
  network: string,
  hash: string,
  options: {
    maxAttempts?: number;
    intervalMs?: number;
    onStatus?: (status: NormalizedTransactionResult) => void;
  } = {},
): Promise<NormalizedTransactionResult> {
  const { maxAttempts = 20, intervalMs = 2000, onStatus } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await getTransactionStatus(network, hash);
    
    onStatus?.(status);

    if (status.status === "success" || status.status === "failed") {
      return status;
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new TransactionApiError(
    "Transaction polling timed out",
    "TIMEOUT_ERROR",
  );
}
