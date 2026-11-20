import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, filter-bound cursors for the audit list endpoint (#1381).
 *
 * A cursor is `<base64url(payload)>.<base64url(HMAC-SHA256(payload))>` where the
 * payload carries the keyset position `(createdAt, id)` and a digest of the
 * filters that were active. A cursor that was edited, truncated, not produced by
 * this service, or reused with different filters is rejected with a
 * field-level reason instead of silently restarting from the first page.
 * Pure: no Nest or Prisma imports.
 */

export interface AuditCursorPosition {
  createdAt: Date;
  id: string;
}

export type AuditCursorFailure = "MALFORMED" | "TAMPERED" | "FILTER_MISMATCH";

export type AuditCursorResult =
  | { ok: true; position: AuditCursorPosition }
  | { ok: false; reason: AuditCursorFailure; message: string };

/** Field-level validation error shape for the `cursor` query parameter. */
export interface CursorFieldError {
  field: "cursor";
  code: AuditCursorFailure;
  message: string;
}

const MESSAGES: Record<AuditCursorFailure, string> = {
  MALFORMED: "cursor is not a valid pagination cursor",
  TAMPERED: "cursor was modified or was not issued by this API",
  FILTER_MISMATCH: "cursor was issued for different filters; restart pagination without a cursor",
};

export const MAX_AUDIT_CURSOR_LENGTH = 512;

const b64 = (buf: Buffer) => buf.toString("base64url");

/** Secret used to sign cursors. Set AUDIT_CURSOR_SECRET in production. */
export function resolveCursorSecret(env: NodeJS.ProcessEnv = process.env): string {
  return env.AUDIT_CURSOR_SECRET || env.ADMIN_API_KEY || "devconsole-audit-cursor-default";
}

/** Digest of the active filters, so a cursor cannot be reused under different ones. */
export function filterDigest(filters: Record<string, unknown> = {}): string {
  const canonical = Object.keys(filters)
    .filter((k) => filters[k] !== undefined && filters[k] !== null && filters[k] !== "")
    .sort()
    .map((k) => `${k}=${String(filters[k])}`)
    .join("&");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

function sign(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function encodeAuditCursor(
  position: AuditCursorPosition,
  filters: Record<string, unknown>,
  secret: string = resolveCursorSecret(),
): string {
  const payload = b64(
    Buffer.from(JSON.stringify({ t: position.createdAt.toISOString(), i: position.id, f: filterDigest(filters) })),
  );
  return `${payload}.${b64(sign(payload, secret))}`;
}

const fail = (reason: AuditCursorFailure): AuditCursorResult => ({ ok: false, reason, message: MESSAGES[reason] });

export function decodeAuditCursor(
  cursor: string,
  filters: Record<string, unknown>,
  secret: string = resolveCursorSecret(),
): AuditCursorResult {
  if (typeof cursor !== "string" || cursor === "" || cursor.length > MAX_AUDIT_CURSOR_LENGTH) return fail("MALFORMED");
  const parts = cursor.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) {
    return fail("MALFORMED");
  }
  const [payload, signature] = parts;
  const expected = sign(payload, secret);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return fail("TAMPERED");

  let parsed: { t?: unknown; i?: unknown; f?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return fail("MALFORMED");
  }
  if (typeof parsed.t !== "string" || typeof parsed.i !== "string" || typeof parsed.f !== "string") return fail("MALFORMED");
  const createdAt = new Date(parsed.t);
  if (Number.isNaN(createdAt.getTime())) return fail("MALFORMED");
  if (parsed.f !== filterDigest(filters)) return fail("FILTER_MISMATCH");
  return { ok: true, position: { createdAt, id: parsed.i } };
}

/** The field-level error for a failed decode. */
export function toCursorFieldError(result: Extract<AuditCursorResult, { ok: false }>): CursorFieldError {
  return { field: "cursor", code: result.reason, message: result.message };
}
