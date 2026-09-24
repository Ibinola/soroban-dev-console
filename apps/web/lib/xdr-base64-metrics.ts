/**
 * Issue #1108: real-time Base64 character-count / byte-length metrics for the
 * XDR tools textarea.
 *
 * The helpers here are pure so they can run in the browser (no Buffer, no
 * atob) and be unit-tested directly.
 */

export type XdrInputKind = "empty" | "base64" | "hex" | "unknown";

export interface XdrInputMetrics {
  /** Detected encoding of the (whitespace-stripped) input. */
  kind: XdrInputKind;
  /** Characters the decoder will actually read (whitespace excluded). */
  charCount: number;
  /** Decoded payload size in bytes, derived from the input length. */
  byteLength: number;
  /** `true` when the input length is legal for its encoding. */
  lengthAligned: boolean;
  /** Human-readable warning for the badge row, or `null` when the input is fine. */
  warning: string | null;
}

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const HEX_RE = /^[0-9a-fA-F]+$/;

/** XDR pasted from logs often carries newlines/spaces — those are not payload. */
export function stripXdrWhitespace(input: string): string {
  return (input ?? "").replace(/\s+/g, "");
}

function base64ByteLength(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((value.length * 3) / 4) - padding);
}

function detectKind(value: string): XdrInputKind {
  if (!value) return "empty";
  // Same precedence as detectEncoding() in lib/xdr-schema-validator.ts.
  if (HEX_RE.test(value) && value.length % 2 === 0) return "hex";
  if (BASE64_RE.test(value)) return "base64";
  return "unknown";
}

/**
 * Measure a raw textarea value: character count, decoded byte length and
 * Base64 padding validity.
 */
export function analyzeXdrInput(input: string): XdrInputMetrics {
  const value = stripXdrWhitespace(input);
  const kind = detectKind(value);

  if (kind === "empty") {
    return { kind, charCount: 0, byteLength: 0, lengthAligned: false, warning: null };
  }

  if (kind === "hex") {
    const aligned = value.length % 2 === 0;
    return {
      kind,
      charCount: value.length,
      byteLength: Math.floor(value.length / 2),
      lengthAligned: aligned,
      warning: aligned ? null : "Hex input has an odd number of characters — one byte is incomplete.",
    };
  }

  if (kind === "base64") {
    const aligned = value.length % 4 === 0;
    return {
      kind,
      charCount: value.length,
      byteLength: base64ByteLength(value),
      lengthAligned: aligned,
      warning: aligned
        ? null
        : `Length is not a multiple of 4 (${value.length % 4} extra character${value.length % 4 === 1 ? "" : "s"}) — this Base64 string looks truncated.`,
    };
  }

  return {
    kind,
    charCount: value.length,
    byteLength: 0,
    lengthAligned: false,
    warning: "Not valid Base64 or hex — remove the unsupported characters before decoding.",
  };
}
