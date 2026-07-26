import { Injectable, OnModuleInit } from "@nestjs/common";
import { DomainEventBus } from "../../lib/domain-event-bus.js";
import {
  RPC_PROXIED,
  RPC_CACHE_HIT,
  RPC_UPSTREAM_ERROR,
} from "../../lib/domain-events.js";

interface LatencyEntry {
  durationMs: number;
  timestamp: number;
}

const SLIDING_WINDOW_MS = 60_000;

@Injectable()
export class RpcMetricsService implements OnModuleInit {
  private totalRequests = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private upstreamErrors = 0;
  private latencyWindow: LatencyEntry[] = [];

  constructor(private readonly events: DomainEventBus) {}

  onModuleInit() {
    this.events.on(RPC_PROXIED, () => {
      this.totalRequests++;
    });

    this.events.on(RPC_CACHE_HIT, () => {
      this.cacheHits++;
    });

    this.events.on(RPC_UPSTREAM_ERROR, () => {
      this.upstreamErrors++;
    });

    this.events.on(RPC_PROXIED, (payload: any) => {
      if (payload && typeof payload.durationMs === "number") {
        const now = Date.now();
        this.latencyWindow.push({ durationMs: payload.durationMs, timestamp: now });
        this.pruneWindow(now);
      }
      if (payload && !payload.cached) {
        this.cacheMisses++;
      }
    });
  }

  private pruneWindow(now: number): void {
    const cutoff = now - SLIDING_WINDOW_MS;
    while (this.latencyWindow.length > 0 && this.latencyWindow[0]!.timestamp < cutoff) {
      this.latencyWindow.shift();
    }
  }

  getMetrics() {
    const now = Date.now();
    this.pruneWindow(now);

    const avgLatencyMs =
      this.latencyWindow.length > 0
        ? Math.round(
            this.latencyWindow.reduce((sum, e) => sum + e.durationMs, 0) /
              this.latencyWindow.length,
          )
        : 0;

    return {
      totalRequests: this.totalRequests,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      upstreamErrors: this.upstreamErrors,
      avgLatencyMs,
    };
  }
}
