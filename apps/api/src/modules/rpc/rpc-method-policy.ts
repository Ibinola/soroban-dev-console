/**
 * BE-007: Method-level RPC policy enforcement.
 *
 * Defines which methods are allowed, and per-method timeout budgets.
 * Unsupported methods are rejected with a structured error before hitting upstream.
 */

export interface MethodPolicy {
  /** Timeout in ms for this method. Falls back to DEFAULT_TIMEOUT_MS. */
  timeoutMs: number;
}

/** Explicitly allowed Soroban RPC methods and their policies. */
export const METHOD_POLICIES: Record<string, MethodPolicy> = {
  // Read-only / cheap
  getLatestLedger:    { timeoutMs: 5_000 },
  getNetwork:         { timeoutMs: 5_000 },
  getVersionInfo:     { timeoutMs: 5_000 },
  getFeeStats:        { timeoutMs: 5_000 },
  getHealth:          { timeoutMs: 5_000 },

  // Read-only / moderate cost
  getAccount:         { timeoutMs: 10_000 },
  getLedgerEntries:   { timeoutMs: 10_000 },
  getContractData:    { timeoutMs: 10_000 },
  getContractWasm:    { timeoutMs: 10_000 },
  getEvents:          { timeoutMs: 15_000 },
  getTransaction:     { timeoutMs: 10_000 },
  getTransactions:    { timeoutMs: 15_000 },

  // High-cost / simulation
  simulateTransaction: { timeoutMs: 30_000 },

  // Mutating
  sendTransaction:    { timeoutMs: 20_000 },
};

export const DEFAULT_TIMEOUT_MS = 15_000;

const ALLOWED_METHODS = new Set(Object.keys(METHOD_POLICIES));

export function isMethodAllowed(method: string): boolean {
  return ALLOWED_METHODS.has(method);
}

export function getMethodPolicy(method: string): MethodPolicy {
  return METHOD_POLICIES[method] ?? { timeoutMs: DEFAULT_TIMEOUT_MS };
}

export function buildMethodNotAllowedError(method: string, id?: string | number | null) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code: -32601,
      message: `Method not found: '${method}' is not supported by this proxy`,
      data: { allowedMethods: [...ALLOWED_METHODS] },
    },
  };
}
