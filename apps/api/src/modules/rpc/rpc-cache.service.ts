/**
 * DEVOPS-006: API-side caching and in-flight deduplication for read-heavy RPC calls.
 *
 * Safe read-only methods are cached with a short TTL.
 * Duplicate in-flight requests for the same key are coalesced into one upstream call.
 * Unsafe/mutating methods are never cached.
 */

import { Injectable } from "@nestjs/common";

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

/** TTL in milliseconds per method. Defaults to DEFAULT_TTL if not specified. */
const METHOD_TTL_MS: Record<string, number> = {
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

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

@Injectable()
export class RpcCacheService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<unknown>>();

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
    const ttl = METHOD_TTL_MS[method] ?? DEFAULT_TTL_MS;
    this.cache.set(key, { value, expiresAt: Date.now() + ttl });
  }

  /**
   * Deduplicates in-flight requests.
   * If a request for `key` is already in-flight, returns the same promise.
   * Otherwise, calls `fn` and stores the promise until it resolves/rejects.
   */
  async deduplicate<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fn().finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  /** Evict all expired entries (call periodically if needed). */
  evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) this.cache.delete(key);
    }
  }
}
