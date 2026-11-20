/**
 * Retry-After header parsing, shared by HTTP and RPC clients.
 *
 * Accepts the two forms RFC 9110 defines: delta-seconds ("120") and an
 * IMF-fixdate HTTP-date ("Wed, 21 Oct 2015 07:28:00 GMT"). The date form is
 * parsed from its GMT text only, so the result never depends on the local
 * timezone. Anything malformed, past or non-positive yields a bounded
 * fallback instead of an exception.
 */

export const DEFAULT_RETRY_FALLBACK_MS = 1_000;
export const DEFAULT_RETRY_MAX_MS = 5 * 60_000;

export interface RetryAfterOptions {
  /** "Now" for date comparisons; a Date or epoch milliseconds. Defaults to the current time. */
  now?: Date | number;
  /** Delay used when the header is missing, malformed or in the past. */
  fallbackMs?: number;
  /** Upper bound for any returned delay. */
  maxMs?: number;
}

export interface RetryAfterResult {
  /** Always a non-negative integer number of milliseconds, never above `maxMs`. */
  delayMs: number;
  source: "seconds" | "http-date" | "fallback";
  /** True when the header was understood (even if the delay was then capped). */
  valid: boolean;
}

const SECONDS = /^[0-9]{1,10}$/;
const IMF_FIXDATE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (0[1-9]|[12][0-9]|3[01]) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]{4} ([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60) GMT$/;

export function parseRetryAfter(header: string | null | undefined, options: RetryAfterOptions = {}): RetryAfterResult {
  const maxMs = Math.max(0, Math.floor(options.maxMs ?? DEFAULT_RETRY_MAX_MS));
  const fallbackMs = Math.min(Math.max(0, Math.floor(options.fallbackMs ?? DEFAULT_RETRY_FALLBACK_MS)), maxMs);
  const fallback: RetryAfterResult = { delayMs: fallbackMs, source: "fallback", valid: false };

  if (typeof header !== "string") return fallback;
  const value = header.trim();

  if (SECONDS.test(value)) {
    return { delayMs: Math.min(Number(value) * 1000, maxMs), source: "seconds", valid: true };
  }

  if (IMF_FIXDATE.test(value)) {
    const at = Date.parse(value);
    if (Number.isNaN(at)) return fallback;
    const now = options.now instanceof Date ? options.now.getTime() : (options.now ?? Date.now());
    const delta = at - now;
    if (delta <= 0) return fallback; // a date in the past carries no usable delay
    return { delayMs: Math.min(delta, maxMs), source: "http-date", valid: true };
  }

  return fallback;
}
