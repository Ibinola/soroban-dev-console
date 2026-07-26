/**
 * DEVOPS-006: API-side caching and in-flight deduplication for read-heavy RPC calls.
 *
 * Safe read-only methods are cached with a short TTL.
 * Duplicate in-flight requests for the same key are coalesced into one upstream call.
 * Unsafe/mutating methods are never cached.
 *
 * TTLs are configurable via RPC_TTL_<METHOD> env vars or runtime config.
 * Deduplication window is configurable via RPC_DEDUP_WINDOW_MS env var.
 */

import { Injectable } from "@nestjs/common";
import { DomainEventBus } from "../../lib/domain-event-bus.js";
import { RPC_DEDUP_HIT } from "../../lib/domain-events.js";

/** RPC methods that are safe to cache (read-only, no side effects). */
const CACHEABLE_METHODS = new Set([
  "getLatestLedger",
  "getLedgerEntries",
  "getNetwork",
  "getFeeStats",
  "getVersionInfo",
  "getContractData",
  "getContractWasm",
  "getAccount",
]);

/** Default TTL in milliseconds per method. */
const DEFAULT_METHOD_TTL_MS: Record<string, number> = {
  getLatestLedger: 5_000,
  getFeeStats: 10_000,
  getNetwork: 60_000,
  getVersionInfo: 60_000,
  getLedgerEntries: 15_000,
  getContractData: 15_000,
  getContractWasm: 30_000,
  getAccount: 10_000,
};

const DEFAULT_TTL_MS = 10_000;
const DEFAULT_DEDUP_WINDOW_MS = 5_000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

interface InflightEntry {
  promise: Promise<unknown>;
  createdAt: number;
}

@Injectable()
export class RpcCacheService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, InflightEntry>();
  private readonly dedupStats = { totalDeduped: 0 };

  private readonly methodTtl: Record<string, number>;
  private readonly dedupWindowMs: number;

  constructor(private readonly events: DomainEventBus) {
    this.methodTtl = this.loadMethodTtls();
    this.dedupWindowMs = this.loadDedupWindow();
  }

  private loadMethodTtls(): Record<string, number> {
    const ttls: Record<string, number> = { ...DEFAULT_METHOD_TTL_MS };
    for (const method of CACHEABLE_METHODS) {
      const envKey = `RPC_TTL_${method}`;
      const envVal = process.env[envKey];
      if (envVal !== undefined) {
        const parsed = parseInt(envVal, 10);
        if (!isNaN(parsed) && parsed > 0) {
          ttls[method] = parsed;
        }
      }
    }
    return ttls;
  }

  private loadDedupWindow(): number {
    const envVal = process.env.RPC_DEDUP_WINDOW_MS;
    if (envVal !== undefined) {
      const parsed = parseInt(envVal, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return DEFAULT_DEDUP_WINDOW_MS;
  }

  isCacheable(method: string): boolean {
    return CACHEABLE_METHODS.has(method);
  }

  buildKey(network: string, method: string, params: unknown): string {
    return `${network}:${method}:${JSON.stringify(params ?? null)}`;
  }

  get(key: string): unknown | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, method: string, value: unknown): void {
    const ttl = this.methodTtl[method] ?? DEFAULT_TTL_MS;
    this.cache.set(key, { value, expiresAt: Date.now() + ttl });
  }

  /**
   * Deduplicates in-flight requests with max window enforcement.
   * If a request for `key` is already in-flight and not older than dedupWindowMs,
   * returns the same promise. Otherwise, calls `fn` and stores the promise.
   */
  async deduplicate<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) {
      const age = Date.now() - existing.createdAt;
      if (age < this.dedupWindowMs) {
        this.dedupStats.totalDeduped++;
        this.events.emit(RPC_DEDUP_HIT, {
          network: key.split(":")[0] ?? "",
          method: key.split(":")[1] ?? "",
          key,
          waitersBefore: this.inflight.size,
        });
        return existing.promise as Promise<T>;
      }
      // Existing request is too old — let a new one proceed
    }

    const promise = fn().finally(() => this.inflight.delete(key));
    this.inflight.set(key, { promise, createdAt: Date.now() });
    return promise;
  }

  /** Evict all expired entries (call periodically if needed). */
  evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) this.cache.delete(key);
    }
  }

  /** Get current TTL configuration for all cacheable methods. */
  getTtlConfig(): Record<string, number> {
    return { ...this.methodTtl };
  }

  /** Update TTL for a specific method at runtime. */
  setTtl(method: string, ttlMs: number): void {
    if (ttlMs > 0) {
      this.methodTtl[method] = ttlMs;
    }
  }

  /** Invalidate cache entries matching the given method and/or network. */
  invalidate(method?: string, network?: string): number {
    let count = 0;
    for (const [key] of this.cache) {
      const parts = key.split(":");
      const keyNetwork = parts[0] ?? "";
      const keyMethod = parts[1] ?? "";

      const matchesMethod = !method || keyMethod === method;
      const matchesNetwork = !network || keyNetwork === network;

      if (matchesMethod && matchesNetwork) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Flush the entire cache. */
  flushAll(): void {
    this.cache.clear();
  }

  /** Get deduplication statistics. */
  getDedupStats(): { totalDeduped: number; activeInFlight: number; keys: string[] } {
    return {
      totalDeduped: this.dedupStats.totalDeduped,
      activeInFlight: this.inflight.size,
      keys: Array.from(this.inflight.keys()),
    };
  }

  /** Get the configured dedup window in ms. */
  getDedupWindowMs(): number {
    return this.dedupWindowMs;
  }
}
