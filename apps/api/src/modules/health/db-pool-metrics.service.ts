import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";

export interface DbPoolMetrics {
  supported: boolean;
  available: boolean;
  active: number;
  idle: number;
  waiting: number;
  observedAt: string;
  reason?: "unsupported" | "unavailable";
}

const METRIC_NAMES = {
  active: /^prisma_pool_connections_busy$/,
  idle: /^prisma_pool_connections_idle$/,
  waiting: /^prisma_pool_connections_waiting$/,
} as const;

export function parsePrometheusPoolMetrics(text: string, observedAt: string): DbPoolMetrics {
  const values: Record<keyof typeof METRIC_NAMES, number> = {
    active: 0,
    idle: 0,
    waiting: 0,
  };

  for (const line of String(text).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.includes("{")) continue;
    const match = /^([a-zA-Z_:][a-zA-Z0-9_:]*)\s+(-?\d+(?:\.\d+)?)$/.exec(trimmed);
    if (!match) continue;
    const name = match[1];
    const value = Number(match[2]);
    if (!Number.isFinite(value)) continue;
    for (const key of Object.keys(METRIC_NAMES) as Array<keyof typeof METRIC_NAMES>) {
      if (METRIC_NAMES[key].test(name)) values[key] = Math.max(0, Math.trunc(value));
    }
  }

  return {
    supported: true,
    available: true,
    active: values.active,
    idle: values.idle,
    waiting: values.waiting,
    observedAt,
  };
}

function unavailable(observedAt: string, reason: "unsupported" | "unavailable"): DbPoolMetrics {
  return {
    supported: false,
    available: false,
    active: 0,
    idle: 0,
    waiting: 0,
    observedAt,
    reason,
  };
}

@Injectable()
export class DbPoolMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(): Promise<DbPoolMetrics> {
    const observedAt = new Date().toISOString();
    try {
      const client = this.prisma as unknown as {
        $metrics?: { prometheus?: () => Promise<string> };
      };
      if (typeof client.$metrics?.prometheus !== "function") {
        return unavailable(observedAt, "unsupported");
      }
      const payload = await client.$metrics.prometheus();
      return parsePrometheusPoolMetrics(payload, observedAt);
    } catch {
      return unavailable(observedAt, "unavailable");
    }
  }
}
