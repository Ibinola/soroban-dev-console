/**
 * Versioned, opaque pagination cursor codec for compound sort keys.
 *
 * A cursor is the base64url form of `{"v":1,"k":[...]}` where `k` is the
 * ordered list of sort-key values (strings, finite numbers, booleans or null).
 * The result is URL safe (`A-Za-z0-9_-`, no padding) and at most
 * `MAX_CURSOR_LENGTH` characters; clients must treat it as opaque.
 */

export type CursorValue = string | number | boolean | null;
export type CursorKey = readonly CursorValue[];

export const CURSOR_VERSION = 1;
/** Longest encoded cursor accepted or produced. */
export const MAX_CURSOR_LENGTH = 512;
export const MAX_CURSOR_KEY_PARTS = 8;

export type CursorErrorCode = "MALFORMED" | "UNSUPPORTED_VERSION" | "TOO_LONG" | "INVALID_KEY";

export class CursorError extends Error {
  constructor(readonly code: CursorErrorCode, message: string) {
    super(message);
    this.name = "CursorError";
  }
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function assertKey(key: unknown): asserts key is CursorKey {
  if (!Array.isArray(key) || key.length === 0 || key.length > MAX_CURSOR_KEY_PARTS) {
    throw new CursorError("INVALID_KEY", `cursor key must have 1-${MAX_CURSOR_KEY_PARTS} parts`);
  }
  for (const part of key) {
    const ok =
      part === null ||
      typeof part === "string" ||
      typeof part === "boolean" ||
      (typeof part === "number" && Number.isFinite(part));
    if (!ok) throw new CursorError("INVALID_KEY", "cursor key parts must be strings, finite numbers, booleans or null");
  }
}

/** Encode a compound sort key. Throws `INVALID_KEY` or `TOO_LONG`. */
export function encodeCursor(key: CursorKey): string {
  assertKey(key);
  const encoded = toBase64Url(JSON.stringify({ v: CURSOR_VERSION, k: key }));
  if (encoded.length > MAX_CURSOR_LENGTH) {
    throw new CursorError("TOO_LONG", `encoded cursor exceeds ${MAX_CURSOR_LENGTH} characters`);
  }
  return encoded;
}

/** Decode a cursor produced by `encodeCursor`. Throws a typed `CursorError`. */
export function decodeCursor(cursor: string): CursorKey {
  if (typeof cursor !== "string" || cursor === "") throw new CursorError("MALFORMED", "cursor must be a non-empty string");
  if (cursor.length > MAX_CURSOR_LENGTH) throw new CursorError("TOO_LONG", `cursor exceeds ${MAX_CURSOR_LENGTH} characters`);
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new CursorError("MALFORMED", "cursor contains invalid characters");

  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(cursor));
  } catch {
    throw new CursorError("MALFORMED", "cursor could not be decoded");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new CursorError("MALFORMED", "cursor payload is not an object");
  }
  const { v, k } = parsed as { v?: unknown; k?: unknown };
  if (typeof v !== "number") throw new CursorError("MALFORMED", "cursor has no version");
  if (v !== CURSOR_VERSION) throw new CursorError("UNSUPPORTED_VERSION", `cursor version ${v} is not supported`);
  try {
    assertKey(k);
  } catch {
    throw new CursorError("MALFORMED", "cursor key is invalid");
  }
  return k;
}
