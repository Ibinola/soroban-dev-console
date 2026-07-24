export type ErrorCategory =
  | "auth"
  | "simulation"
  | "invocation"
  | "network"
  | "contract"
  | "unknown";

export interface DecodedError {
  category: ErrorCategory;
  summary: string;
  detail: string;
  raw: string;
}

const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  category: ErrorCategory;
  summary: string;
}> = [
  { pattern: /auth|unauthorized|signature/i, category: "auth", summary: "Authorization failure" },
  { pattern: /simulation|preflight/i, category: "simulation", summary: "Simulation error" },
  { pattern: /invoke|invocation/i, category: "invocation", summary: "Invocation error" },
  { pattern: /network|timeout|connection/i, category: "network", summary: "Network error" },
  { pattern: /trap|wasm|contract/i, category: "contract", summary: "Contract execution error" },
];

export function decodeError(raw: string): DecodedError {
  if (!raw) {
    return { category: "unknown", summary: "Unknown error", detail: "", raw: "" };
  }

  for (const { pattern, category, summary } of ERROR_PATTERNS) {
    if (pattern.test(raw)) {
      return { category, summary, detail: raw, raw };
    }
  }

  return { category: "unknown", summary: "Unexpected error", detail: raw, raw };
}

export function formatErrorForDisplay(decoded: DecodedError): string {
  return `[${decoded.category.toUpperCase()}] ${decoded.summary}: ${decoded.detail}`;
}

/** Maximum automatic retries for transient (timeout/network) failures. */
export const MAX_AUTO_RETRIES = 3;

export type RetryAction = "resign-sequence" | "fee-bump" | "auto-retry" | "manual" | "none";

/**
 * Classify a raw transaction error into the recovery action the retry UI
 * should offer. Keeps the retry state machine logic in one testable place.
 */
export function classifyRetry(raw: string, attempts = 0): RetryAction {
  if (!raw) return "none";
  const text = raw.toLowerCase();

  if (text.includes("txbad_seq") || text.includes("bad_seq")) return "resign-sequence";
  if (text.includes("txinsufficient_fee") || text.includes("insufficient_fee")) return "fee-bump";

  const transient = /timeout|network|connection|temporarily|try again/i.test(raw);
  if (transient) return attempts < MAX_AUTO_RETRIES ? "auto-retry" : "manual";

  return "manual";
}

/** Bump a fee by a multiplier, rounded up to a whole stroop. */
export function bumpFee(baseFee: number, multiplier = 2): number {
  return Math.ceil(baseFee * multiplier);
}
