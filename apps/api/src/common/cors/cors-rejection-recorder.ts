/**
 * Issue #1138: Security audit logging for rejected CORS origin attempts.
 *
 * The `origin` callback of the NestJS CORS middleware does not expose the
 * request path, so rejection detection is split in two:
 *   1. `resolveCorsAllowlist()` / `isOriginAllowed()` — single source of truth
 *      for which origins are permitted (matches `buildCorsOrigin` in main.ts).
 *   2. `CorsRejectionRecorder` — throttles audit writes to at most 5 per minute
 *      per origin to keep the audit log from being flooded by cross-site abuse.
 *
 * `mapCorsRejectionToAuditEntry()` builds the AuditEntry dispatched by the app.
 */

import type { AuditEntry } from "../../lib/audit.service.js";

export const CORS_MAX_LOGS_PER_MINUTE = 5;
export const CORS_WINDOW_MS = 60_000;

/** Issue #1138: 5 logs per origin per rolling 60s window. */
export class CorsRejectionRecorder {
  private readonly buckets = new Map<string, { start: number; count: number }>();

  /** True when this origin has not exhausted its per-minute log budget. */
  wantsLog(origin: string, now: number = Date.now()): boolean {
    const record = this.buckets.get(origin);
    if (!record || now - record.start >= CORS_WINDOW_MS) return true;
    return record.count < CORS_MAX_LOGS_PER_MINUTE;
  }

  /** Record an occurrence; returns whether it should still be written. */
  note(origin: string, now: number = Date.now()): boolean {
    const record = this.buckets.get(origin);
    if (!record || now - record.start >= CORS_WINDOW_MS) {
      this.buckets.set(origin, { start: now, count: 1 });
      return true;
    }
    record.count += 1;
    return record.count <= CORS_MAX_LOGS_PER_MINUTE;
  }

  reset(): void {
    this.buckets.clear();
  }
}

/**
 * Resolve the effective CORS allowlist (mirrors `buildCorsOrigin`).
 * - ALLOWED_ORIGINS / CORS_ORIGINS (comma-separated) when set
 * - production: empty (all cross-origin rejected), otherwise the WEB_ORIGIN
 *   (or the localhost default)
 */
export function resolveCorsAllowlist(): string[] {
  const corsOrigins = process.env.ALLOWED_ORIGINS ?? process.env.CORS_ORIGINS;
  if (corsOrigins) {
    return corsOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
  if (process.env.NODE_ENV === "production") return [];
  return [process.env.WEB_ORIGIN ?? "http://localhost:3000"];
}

export function isOriginAllowed(origin: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return false;
  return allowlist.includes(origin);
}

/** Build the audit record for a rejected origin, capturing domain + path. */
export function mapCorsRejectionToAuditEntry(origin: string, path: string): AuditEntry {
  let domain = origin;
  try {
    domain = new URL(origin).hostname;
  } catch {
    // Origin header was not a parsable URL — keep it verbatim for review.
  }

  return {
    actor: "system",
    action: "cors.origin.rejected",
    resourceType: "http",
    resourceId: path || "/",
    summary: `Rejected CORS origin ${domain}`,
    metadata: { origin, domain, path: path || "/" },
  };
}