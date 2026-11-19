import { createHash } from "node:crypto";

/**
 * Per-stream hash chaining for audit events (#1377).
 *
 * Pure and free of Nest/Prisma imports. A stream is `<resourceType>:<resourceId>`.
 * Each event's hash covers its canonical form, which includes the previous
 * event's hash, so editing, deleting or reordering any stored row breaks the
 * link at (or just after) the change.
 *
 * Mutable presentation fields (`summary`, which is free display text and may be
 * re-redacted on export) are NOT hashed; the identifying and behavioural
 * fields are.
 */

export interface ChainableAuditEvent {
  id: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: unknown;
  createdAt: Date | string;
}

export interface ChainedAuditEvent extends ChainableAuditEvent {
  hash: string | null;
  prevHash: string | null;
}

export const AUDIT_HASH_VERSION = 1;

export function auditStreamKey(resourceType: string, resourceId: string): string {
  return `${resourceType}:${resourceId}`;
}

/** JSON with object keys sorted at every level, so equal values serialize identically. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") {
    return typeof value === "bigint" ? JSON.stringify(value.toString()) : (JSON.stringify(value) ?? "null");
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(",")}}`;
}

/** The exact string that is hashed for an event. */
export function canonicalAuditPayload(event: ChainableAuditEvent, prevHash: string | null): string {
  return canonicalJson({
    v: AUDIT_HASH_VERSION,
    actor: event.actor,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    metadata: event.metadata ?? null,
    createdAt: new Date(event.createdAt).toISOString(),
    prevHash,
  });
}

export function computeAuditHash(event: ChainableAuditEvent, prevHash: string | null): string {
  return createHash("sha256").update(canonicalAuditPayload(event, prevHash)).digest("hex");
}

export interface ChainVerification {
  ok: boolean;
  checked: number;
  /** Rows that predate the chain (no hash); they are skipped, not reported as broken. */
  unchained: number;
  firstBroken?: {
    index: number;
    id: string;
    reason: "PREV_HASH_MISMATCH" | "HASH_MISMATCH";
    expected: string | null;
    actual: string | null;
  };
  /** The range that can no longer be trusted: from the first broken event to the last one checked. */
  affectedRange?: { fromId: string; toId: string; count: number };
}

/**
 * Verify a stream's events, given oldest first. Reports the first broken link
 * and the range from there to the end of the supplied events.
 */
export function verifyAuditChain(events: readonly ChainedAuditEvent[]): ChainVerification {
  let prev: string | null = null;
  let checked = 0;
  let unchained = 0;
  let started = false;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.hash === null) {
      unchained += 1;
      continue;
    }
    // The first chained event may follow unchained legacy rows: it must start the chain (prevHash null).
    const expectedPrev: string | null = started ? prev : null;
    const broken = (reason: "PREV_HASH_MISMATCH" | "HASH_MISMATCH", expected: string | null, actual: string | null) => ({
      ok: false,
      checked,
      unchained,
      firstBroken: { index, id: event.id, reason, expected, actual },
      affectedRange: { fromId: event.id, toId: events[events.length - 1].id, count: events.length - index },
    });

    if (event.prevHash !== expectedPrev) return broken("PREV_HASH_MISMATCH", expectedPrev, event.prevHash);
    const expectedHash = computeAuditHash(event, event.prevHash);
    if (event.hash !== expectedHash) return broken("HASH_MISMATCH", expectedHash, event.hash);

    prev = event.hash;
    started = true;
    checked += 1;
  }
  return { ok: true, checked, unchained };
}
