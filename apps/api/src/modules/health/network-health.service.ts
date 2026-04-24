/**
 * BE-009: API-backed network health aggregation.
 *
 * Probes each configured network's RPC endpoint and returns a unified health payload.
 * Results are cached briefly to avoid hammering upstreams under concurrent load.
 */

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface NetworkHealthPayload {
  network: string;
  status: "healthy" | "degraded" | "offline";
  latestLedger: number;
  latencyMs: number;
  checkedAt: number;
}

const CACHE_TTL_MS = 15_000;
const PROBE_TIMEOUT_MS = 8_000;
const DEGRADED_LATENCY_MS = 1_500;

const NETWORKS = ["mainnet", "testnet", "futurenet", "local"] as const;

interface CacheEntry {
  payload: NetworkHealthPayload;
  expiresAt: number;
}

@Injectable()
export class NetworkHealthService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<NetworkHealthPayload>>();

  constructor(private readonly configService: ConfigService) {}

  async getHealth(network: string): Promise<NetworkHealthPayload> {
    const cached = this.cache.get(network);
    if (cached && Date.now() < cached.expiresAt) return cached.payload;

    // Deduplicate concurrent probes for the same network
    const existing = this.inflight.get(network);
    if (existing) return existing;

    const promise = this.probe(network).then((payload) => {
      this.cache.set(network, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
      this.inflight.delete(network);
      return payload;
    }).catch((err) => {
      this.inflight.delete(network);
      throw err;
    });

    this.inflight.set(network, promise);
    return promise;
  }

  async getAllHealth(): Promise<NetworkHealthPayload[]> {
    return Promise.all(NETWORKS.map((n) => this.getHealth(n)));
  }

  private async probe(network: string): Promise<NetworkHealthPayload> {
    const key = `SOROBAN_RPC_${network.toUpperCase()}_URL`;
    const rawUrl = this.configService.get<string>(key) ?? "";
    // Use the first URL if multiple are configured (comma-separated)
    const rpcUrl = rawUrl.split(",")[0]?.trim();

    if (!rpcUrl) {
      return { network, status: "offline", latestLedger: 0, latencyMs: 0, checkedAt: Date.now() };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const start = Date.now();

    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestLedger", params: [] }),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - start;
      const json = await res.json() as { result?: { sequence?: number } };
      const latestLedger = json?.result?.sequence ?? 0;

      return {
        network,
        status: latencyMs > DEGRADED_LATENCY_MS ? "degraded" : "healthy",
        latestLedger,
        latencyMs,
        checkedAt: Date.now(),
      };
    } catch {
      return { network, status: "offline", latestLedger: 0, latencyMs: 0, checkedAt: Date.now() };
    } finally {
      clearTimeout(timeout);
    }
  }
}
