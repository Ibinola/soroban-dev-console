import { createHash } from "node:crypto";

export interface OwnerRateLimit {
  /** Requests allowed per sliding minute. */
  max: number;
  /** Requests admitted instantly before the sliding-window check applies. */
  burst: number;
}

export const DEFAULT_OWNER_RATE_LIMIT: OwnerRateLimit = { max: 200, burst: 20 };

/** SHA-256 hex of an owner key, so configs never need to hold the raw secret. */
export function hashOwnerKey(ownerKey: string): string {
  return createHash("sha256").update(ownerKey).digest("hex");
}

function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

export interface OwnerRateLimitConfig {
  defaults: OwnerRateLimit;
  /** Overrides keyed by `sha256:<hex>` or the raw owner key. */
  overrides: Map<string, Partial<OwnerRateLimit>>;
}

/**
 * Reads the rate-limit policy from the environment:
 *   RPC_RATE_LIMIT_OWNER_MAX / RPC_RATE_LIMIT_OWNER_BURST   defaults for every owner
 *   RPC_RATE_LIMIT_OWNER_OVERRIDES   JSON: {"<key or sha256:hex>": {"max": 500, "burst": 50}}
 * Invalid numbers or entries are ignored rather than disabling limiting.
 */
export function parseOwnerRateLimitConfig(env: NodeJS.ProcessEnv = process.env): OwnerRateLimitConfig {
  const defaults: OwnerRateLimit = {
    max: positiveInt(Number(env.RPC_RATE_LIMIT_OWNER_MAX)) ?? DEFAULT_OWNER_RATE_LIMIT.max,
    burst: positiveInt(Number(env.RPC_RATE_LIMIT_OWNER_BURST)) ?? DEFAULT_OWNER_RATE_LIMIT.burst,
  };

  const overrides = new Map<string, Partial<OwnerRateLimit>>();
  const raw = env.RPC_RATE_LIMIT_OWNER_OVERRIDES;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed)) {
          if (!value || typeof value !== "object") continue;
          const entry = value as Record<string, unknown>;
          const max = positiveInt(entry.max);
          const burst = positiveInt(entry.burst);
          if (max === null && burst === null) continue;
          overrides.set(key, { ...(max !== null && { max }), ...(burst !== null && { burst }) });
        }
      }
    } catch {
      // Malformed JSON: fall back to the defaults.
    }
  }
  return { defaults, overrides };
}

/** Effective limits for one owner key: defaults, then any override (hashed key wins over raw). */
export function resolveOwnerRateLimit(ownerKey: string, config: OwnerRateLimitConfig): OwnerRateLimit {
  const override =
    config.overrides.get(`sha256:${hashOwnerKey(ownerKey)}`) ?? config.overrides.get(ownerKey) ?? {};
  const max = override.max ?? config.defaults.max;
  // A burst larger than the window limit would never be reached; clamp it.
  const burst = Math.min(override.burst ?? config.defaults.burst, max);
  return { max, burst };
}
