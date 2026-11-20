import { xdr } from "@stellar/stellar-sdk";

/** Stable codes for XDR decode failures. */
export type DecodeErrorCode =
  | "INVALID_ENCODING" // not valid base64
  | "TRUNCATED_INPUT" // ends before the value does
  | "UNSUPPORTED_VARIANT" // a union discriminant this decoder does not know
  | "DECODE_FAILED"; // anything else the decoder rejected

export interface DecodeDiagnostic {
  code: DecodeErrorCode;
  message: string;
  /** Byte offset of the problem, always within [0, inputLength]; omitted when unknown. */
  offset?: number;
  inputLength: number;
  /** First bytes only (hex, at most `PREVIEW_BYTES`); never the whole payload by default. */
  preview: string;
}

export class XdrDecodeError extends Error {
  constructor(readonly diagnostic: DecodeDiagnostic) {
    super(`${diagnostic.code}: ${diagnostic.message}`);
    this.name = "XdrDecodeError";
  }
}

export const PREVIEW_BYTES = 16;
/** Highest `ScValType` discriminant (scvLedgerKeyNonce = 21). */
export const SCVAL_MAX_DISCRIMINANT = 21;

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function diagnostic(
  code: DecodeErrorCode,
  message: string,
  bytes: Uint8Array,
  offset?: number,
): DecodeDiagnostic {
  return {
    code,
    message,
    inputLength: bytes.length,
    preview: Buffer.from(bytes.subarray(0, PREVIEW_BYTES)).toString("hex"),
    ...(offset === undefined ? {} : { offset: Math.max(0, Math.min(offset, bytes.length)) }),
  };
}

/** Decode base64 strictly; throws an `XdrDecodeError` with `INVALID_ENCODING`. */
export function decodeBase64Strict(input: string): Uint8Array {
  const compact = typeof input === "string" ? input.trim() : "";
  if (compact === "" || !BASE64.test(compact)) {
    throw new XdrDecodeError(diagnostic("INVALID_ENCODING", "input is not valid base64", new Uint8Array(0), 0));
  }
  return new Uint8Array(Buffer.from(compact, "base64"));
}

/**
 * Map a low-level exception from the XDR library to a stable diagnostic. The
 * library's messages are not stable, so this also looks at the bytes: XDR is
 * 4-byte aligned, and an ScVal starts with a 4-byte discriminant.
 */
export function classifyDecodeFailure(error: unknown, bytes: Uint8Array): DecodeDiagnostic {
  if (bytes.length === 0 || bytes.length % 4 !== 0) {
    return diagnostic("TRUNCATED_INPUT", "input ends before the value is complete", bytes, bytes.length);
  }
  const text = error instanceof Error ? error.message : String(error);
  if (/enum|variant|discriminant|union|unknown (type|value)|invalid (type|value)/i.test(text)) {
    return diagnostic("UNSUPPORTED_VARIANT", "unsupported or unknown variant", bytes);
  }
  if (/past the end|out of (range|bounds)|end of (buffer|input|data)|underflow|too (short|small)|insufficient|unexpected end|truncat/i.test(text)) {
    return diagnostic("TRUNCATED_INPUT", "input ends before the value is complete", bytes, bytes.length);
  }
  return diagnostic("DECODE_FAILED", "input is not a valid XDR value", bytes);
}

/**
 * The library does not report truncation uniformly, so test for it directly:
 * if appending zero padding changes the failure (or lets the value decode), the
 * original ran out of bytes rather than being malformed.
 */
function looksTruncated(bytes: Uint8Array, original: unknown): boolean {
  const padded = Buffer.concat([Buffer.from(bytes), Buffer.alloc(256)]);
  try {
    xdr.ScVal.fromXDR(padded);
    return true;
  } catch (error) {
    const before = original instanceof Error ? original.message : String(original);
    const after = error instanceof Error ? error.message : String(error);
    return before !== after;
  }
}

/**
 * Decode a base64 `ScVal`, throwing an `XdrDecodeError` with a stable code
 * instead of whatever the underlying library threw.
 */
export function decodeScValSafe(base64: string): xdr.ScVal {
  const bytes = decodeBase64Strict(base64);
  if (bytes.length === 0 || bytes.length % 4 !== 0) {
    throw new XdrDecodeError(classifyDecodeFailure(undefined, bytes));
  }
  const discriminant = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false);
  if (discriminant > SCVAL_MAX_DISCRIMINANT) {
    throw new XdrDecodeError(diagnostic("UNSUPPORTED_VARIANT", `unknown ScVal type ${discriminant}`, bytes, 0));
  }
  try {
    return xdr.ScVal.fromXDR(Buffer.from(bytes));
  } catch (error) {
    const classified = classifyDecodeFailure(error, bytes);
    if (classified.code === "DECODE_FAILED" && looksTruncated(bytes, error)) {
      throw new XdrDecodeError(
        diagnostic("TRUNCATED_INPUT", "input ends before the value is complete", bytes, bytes.length),
      );
    }
    throw new XdrDecodeError(classified);
  }
}
