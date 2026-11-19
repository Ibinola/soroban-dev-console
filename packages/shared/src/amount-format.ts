/**
 * Pure, locale-aware amount formatter.
 *
 * Amounts are decimal strings (never JS numbers), so large values keep every
 * digit. Locale and currency metadata are explicit inputs; nothing reads the
 * browser or process locale. Rounding is half-up on the decimal digits and is
 * deterministic.
 */

export interface AmountCurrency {
  /** Display symbol or code, e.g. "XLM" or "$". */
  symbol: string;
  /** Put the symbol before (`prefix`) or after (`suffix`, with a space) the number. */
  position?: "prefix" | "suffix";
}

export interface AmountFormatOptions {
  /** BCP 47 tag used for digit grouping and the decimal separator, e.g. "en-US". */
  locale: string;
  currency?: AmountCurrency;
  /** Fraction digits shown at most (default 2). Excess digits are rounded half-up. */
  maxFractionDigits?: number;
  /** Fraction digits always shown (default 0, never above the maximum). */
  minFractionDigits?: number;
}

export type AmountFormatErrorCode = "INVALID_DECIMAL" | "INVALID_OPTIONS";

export type AmountFormatResult =
  | { ok: true; text: string }
  | { ok: false; code: AmountFormatErrorCode; message: string };

const DECIMAL = /^(-)?(0|[1-9][0-9]*)(?:\.([0-9]+))?$/;

function fail(code: AmountFormatErrorCode, message: string): AmountFormatResult {
  return { ok: false, code, message };
}

/** Round `fraction` (digits after the point) half-up to `max` digits; may carry into the integer. */
function roundDecimal(integer: bigint, fraction: string, max: number): { integer: bigint; fraction: string } {
  if (fraction.length <= max) return { integer, fraction };
  const kept = fraction.slice(0, max);
  if (fraction.charCodeAt(max) < 53) return { integer, fraction: kept }; // next digit < 5
  // Round up: treat integer + kept digits as one number and add one unit.
  const scaled = BigInt(integer.toString() + kept) + 1n;
  const text = scaled.toString().padStart(max + 1, "0");
  if (max === 0) return { integer: BigInt(text), fraction: "" };
  return { integer: BigInt(text.slice(0, text.length - max)), fraction: text.slice(text.length - max) };
}

/** Format a decimal string. Invalid input returns a safe validation result, never throws. */
export function formatAmount(value: string, options: AmountFormatOptions): AmountFormatResult {
  const max = options.maxFractionDigits ?? 2;
  const min = Math.min(options.minFractionDigits ?? 0, max);
  if (!Number.isInteger(max) || max < 0 || max > 20 || !Number.isInteger(min) || min < 0) {
    return fail("INVALID_OPTIONS", "fraction digit limits must be integers between 0 and 20");
  }
  if (typeof options.locale !== "string" || options.locale === "") {
    return fail("INVALID_OPTIONS", "a locale is required");
  }
  if (typeof value !== "string") return fail("INVALID_DECIMAL", "amount must be a decimal string");
  const match = DECIMAL.exec(value);
  if (!match) return fail("INVALID_DECIMAL", "amount must be a plain decimal string such as 1234.56");

  let nf: Intl.NumberFormat;
  let decimalSeparator: string;
  try {
    nf = new Intl.NumberFormat(options.locale, { useGrouping: true });
    decimalSeparator = new Intl.NumberFormat(options.locale).formatToParts(1.1).find((p) => p.type === "decimal")?.value ?? ".";
  } catch {
    return fail("INVALID_OPTIONS", "unsupported locale");
  }

  const [, minus, intPart, fracPart = ""] = match;
  const rounded = roundDecimal(BigInt(intPart), fracPart, max);
  const fraction = rounded.fraction.replace(/0+$/, "").padEnd(min, "0");
  const isZero = rounded.integer === 0n && /^0*$/.test(fraction);
  const grouped = nf.format(rounded.integer);
  const number = `${minus && !isZero ? "-" : ""}${grouped}${fraction ? `${decimalSeparator}${fraction}` : ""}`;

  const { currency } = options;
  if (!currency) return { ok: true, text: number };
  const negative = number.startsWith("-");
  const body = negative ? number.slice(1) : number;
  const text =
    (currency.position ?? "suffix") === "prefix"
      ? `${negative ? "-" : ""}${currency.symbol}${body}`
      : `${number} ${currency.symbol}`;
  return { ok: true, text };
}
