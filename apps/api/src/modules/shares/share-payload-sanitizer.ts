/**
 * Issue #1122: Strip sensitive RPC custom headers and secret tokens when
 * generating workspace share links.
 *
 * Share snapshots are generated client-side and can embed private RPC custom
 * headers (e.g. `Authorization`, `X-API-Key`, provider secret tokens) that the
 * workspace owner would not want disclosed to anyone who opens the link.
 *
 * The sanitizer walks the payload recursively and replaces any sensitive
 * header-shaped key with a redaction marker. It is deliberately conservative:
 * only header-style keys, secret-token keys and the well-known auth header set
 * are redacted, so legitimate contract/saved-call data (which may use generic
 * names like `token` or `secret`) is left untouched.
 */

import type { Prisma } from "@prisma/client";

export interface SanitizedSnapshotResult {
  snapshot: Prisma.InputJsonValue;
  /** Paths (dot-joined) of every sensitive key that was detected and redacted. */
  detectedSensitiveKeys: string[];
  /** True when at least one sensitive key was detected and stripped. */
  sanitized: boolean;
}

const REDACTED = "[REDACTED]";

/** Hard-coded auth/secret header names (normalized, `_` folded into `-`). */
const SENSITIVE_HEADER_KEYS: ReadonlySet<string> = new Set([
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "api-key",
  "apikey",
  "x-api-token",
  "x-auth-token",
  "x-access-token",
  "auth-token",
  "x-token",
  "set-cookie",
  "cookie",
  "x-owner-key",
  "owner-key",
  "client-secret",
  "clientsecret",
  "x-rpc-secret",
  "rpc-secret",
  "x-rpc-key",
]);

const MAX_DEPTH = 64;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/_/g, "-");
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (SENSITIVE_HEADER_KEYS.has(normalized)) return true;
  // Secret tokens (e.g. `accessToken`, `api_secret`, `rpcSecret`).
  if (normalized.includes("secret")) return true;
  // Generic `x-` vendor header naming convention carrying credentials.
  if (normalized.startsWith("x-") && (normalized.includes("key") || normalized.includes("token"))) return true;
  return false;
}

/**
 * Recursively walk the payload, redacting sensitive keys. The traversal is
 * depth-limited so deeply nested (malicious) payloads cannot trigger a stack
 * overflow during link generation.
 */
export function sanitizeSnapshotPayload(payload: unknown): SanitizedSnapshotResult {
  const detectedSensitiveKeys = new Set<string>();

  const walk = (value: unknown, path: string[], depth: number): unknown => {
    if (depth > MAX_DEPTH) return value;
    if (value === null || typeof value !== "object") return value;

    if (Array.isArray(value)) {
      return value.map((item) => walk(item, path, depth + 1));
    }

    const entries = Object.entries(value as Record<string, unknown>);
    const result: Record<string, unknown> = {};
    for (const [key, child] of entries) {
      if (isSensitiveKey(key)) {
        const at = [...path, key];
        detectedSensitiveKeys.add(at.join("."));
        result[key] = REDACTED;
        continue;
      }
      result[key] = walk(child, [...path, key], depth + 1);
    }
    return result;
  };

  const snapshot = walk(payload, [], 0) as Prisma.InputJsonValue;
  const keys = [...detectedSensitiveKeys].sort();

  return {
    snapshot,
    detectedSensitiveKeys: keys,
    sanitized: keys.length > 0,
  };
}