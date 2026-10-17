import { createHash } from "node:crypto";

/** Read-only RPC methods that are safe to coalesce (never mutating). */
export const COALESCIBLE_RPC_METHODS: ReadonlySet<string> = new Set([
  "getLatestLedger",
  "getNetwork",
  "getVersionInfo",
  "getFeeStats",
  "getHealth",
  "getAccount",
  "getLedgerEntries",
  "getContractData",
  "getContractWasm",
  "getEvents",
  "getTransaction",
  "getTransactions",
  "simulateTransaction",
]);

export function isCoalescible(method: string): boolean {
  return COALESCIBLE_RPC_METHODS.has(method);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

export interface CoalescerStats {
  hits: number;
  misses: number;
  /** hits / (hits + misses), 0 when nothing has run yet. */
  hitRate: number;
  inFlight: number;
}

/**
 * Coalesces concurrent identical calls into one upstream request. Identity
 * is `network:method:sha256(params)`. Only in-flight calls are shared; once
 * the upstream call settles the next caller starts a fresh one.
 */
export class RequestCoalescer {
  private readonly inflight = new Map<string, Promise<unknown>>();
  private hits = 0;
  private misses = 0;

  static buildKey(network: string, method: string, params: unknown): string {
    const hash = createHash("sha256").update(stableStringify(params ?? null)).digest("hex");
    return `${network}:${method}:${hash}`;
  }

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) {
      this.hits++;
      return existing as Promise<T>;
    }
    this.misses++;
    const promise = fn().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    return promise;
  }

  stats(): CoalescerStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
      inFlight: this.inflight.size,
    };
  }
}

/** Process-wide coalescer shared by the RPC proxy and the health endpoint. */
export const rpcCoalescer = new RequestCoalescer();
