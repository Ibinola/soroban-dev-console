/**
 * Transaction fee arithmetic on decimal strings.
 *
 * Fees are whole numbers of stroops (1 XLM = 10^7 stroops). They are carried as
 * decimal strings and computed with BigInt so values beyond
 * Number.MAX_SAFE_INTEGER stay exact. Negative, fractional (as stroops) and
 * malformed inputs are rejected with a `FeeError`; nothing is silently rounded.
 */

export const STROOPS_PER_XLM = 10_000_000n;
const XLM_DECIMALS = 7;

export type FeeErrorCode = "MALFORMED" | "NEGATIVE" | "PRECISION_LOSS" | "DIVIDE_BY_ZERO";

export class FeeError extends Error {
  constructor(readonly code: FeeErrorCode, message: string) {
    super(message);
    this.name = "FeeError";
  }
}

/** Parse a non-negative whole-number decimal string (or bigint) into a bigint. */
export function parseStroops(value: string | bigint): bigint {
  if (typeof value === "bigint") {
    if (value < 0n) throw new FeeError("NEGATIVE", "fee cannot be negative");
    return value;
  }
  if (typeof value !== "string" || value.trim() !== value || value === "") {
    throw new FeeError("MALFORMED", "fee must be a decimal string with no surrounding whitespace");
  }
  if (value.startsWith("-")) {
    if (/^-(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) throw new FeeError("NEGATIVE", "fee cannot be negative");
    throw new FeeError("MALFORMED", "fee is not a valid decimal string");
  }
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new FeeError("MALFORMED", "fee must be a whole number of stroops (digits only, no leading zeros)");
  }
  return BigInt(value);
}

/** Sum any number of stroop amounts. */
export function addStroops(...values: Array<string | bigint>): string {
  return values.reduce<bigint>((sum, v) => sum + parseStroops(v), 0n).toString();
}

/** `a - b`; rejects a result below zero. */
export function subtractStroops(a: string | bigint, b: string | bigint): string {
  const result = parseStroops(a) - parseStroops(b);
  if (result < 0n) throw new FeeError("NEGATIVE", "result would be negative");
  return result.toString();
}

/**
 * Multiply by a ratio `numerator / denominator` (both whole numbers). The
 * division must be exact, otherwise a `PRECISION_LOSS` error is thrown instead
 * of rounding. Use `multiplyStroopsRounded` when rounding is wanted.
 */
export function multiplyStroops(fee: string | bigint, numerator: string | bigint, denominator: string | bigint = 1n): string {
  const n = parseStroops(numerator);
  const d = parseStroops(denominator);
  if (d === 0n) throw new FeeError("DIVIDE_BY_ZERO", "denominator cannot be zero");
  const product = parseStroops(fee) * n;
  if (product % d !== 0n) throw new FeeError("PRECISION_LOSS", "result is not a whole number of stroops");
  return (product / d).toString();
}

/** Like `multiplyStroops` but rounds up (a fee estimate should never undershoot). */
export function multiplyStroopsRounded(fee: string | bigint, numerator: string | bigint, denominator: string | bigint = 1n): string {
  const n = parseStroops(numerator);
  const d = parseStroops(denominator);
  if (d === 0n) throw new FeeError("DIVIDE_BY_ZERO", "denominator cannot be zero");
  const product = parseStroops(fee) * n;
  return ((product + d - 1n) / d).toString();
}

/** -1, 0 or 1. */
export function compareStroops(a: string | bigint, b: string | bigint): -1 | 0 | 1 {
  const x = parseStroops(a);
  const y = parseStroops(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Convert stroops to an exact XLM decimal string (trailing zeros trimmed). */
export function stroopsToXlm(stroops: string | bigint): string {
  const value = parseStroops(stroops);
  const whole = value / STROOPS_PER_XLM;
  const frac = (value % STROOPS_PER_XLM).toString().padStart(XLM_DECIMALS, "0").replace(/0+$/, "");
  return frac === "" ? whole.toString() : `${whole}.${frac}`;
}

/**
 * Convert an XLM decimal string to stroops. More than 7 fractional digits is
 * rejected (`PRECISION_LOSS`), never rounded.
 */
export function xlmToStroops(xlm: string): string {
  if (typeof xlm !== "string" || !/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(xlm)) {
    throw new FeeError("MALFORMED", "XLM amount must be a decimal string");
  }
  if (xlm.startsWith("-")) throw new FeeError("NEGATIVE", "amount cannot be negative");
  const [whole, frac = ""] = xlm.split(".");
  if (frac.length > XLM_DECIMALS) {
    throw new FeeError("PRECISION_LOSS", `XLM supports at most ${XLM_DECIMALS} decimal places`);
  }
  return (BigInt(whole) * STROOPS_PER_XLM + BigInt(frac.padEnd(XLM_DECIMALS, "0"))).toString();
}
