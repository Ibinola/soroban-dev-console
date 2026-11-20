"use client";

import { useEffect } from "react";
import { useNetworkStore } from "@/store/useNetworkStore";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@devconsole/ui";
import { Switch } from "@devconsole/ui";
import { cn } from "@devconsole/ui";

/**
 * Issue #738: Network latency indicator and RPC endpoint status badge.
 *
 * - Status dot in header: green (healthy), yellow (degraded p95 > 2000ms), red (offline/failed)
 * - Polls GET /api/health/rpc every 30 seconds
 * - Clicking opens a popover showing per-network latency (p50) and last-checked timestamp
 * - Degrades gracefully if the health endpoint is unreachable
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function NetworkHealth() {
  const { currentNetwork, health, setHealth, autoFailover, setAutoFailover, failoverNetworkId, degradationThresholdMs } = useNetworkStore();
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const res = await fetch(`${API_BASE}/api/health/networks/${currentNetwork}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as {
          status: "healthy" | "degraded" | "offline";
          latestLedger: number;
          latencyMs: number;
          checkedAt: number;
        };
        if (!cancelled) {
          setHealth({
            status: data.status,
            latestLedger: data.latestLedger,
            protocolVersion: 0,
            latencyMs: data.latencyMs,
            lastCheck: data.checkedAt,
          });
          setLatencyHistory(prev => [...prev.slice(-4), data.latencyMs]);
        }
      } catch {
        if (!cancelled) {
          setHealth({
            status: "offline",
            latestLedger: 0,
            protocolVersion: 0,
            latencyMs: 0,
            lastCheck: Date.now(),
          });
        }
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentNetwork, setHealth]);

  if (!health) return null;

  // Issue #738: Yellow if p95 > 2000ms, Red if offline, Green if healthy
  const statusColor =
    health.status === "healthy"
      ? "bg-green-500"
      : health.status === "degraded"
      ? "bg-yellow-500"
      : "bg-red-500";

  const statusLabel =
    health.status === "healthy"
      ? "Healthy"
      : health.status === "degraded"
      ? `Degraded (${health.latencyMs}ms)`
      : "Offline";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted"
          aria-label={`Network status: ${statusLabel}`}
        >
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              health.status !== "offline" && "animate-pulse",
              statusColor,
            )}
          />
          <span className="hidden font-mono text-xs text-muted-foreground lg:inline">
            {health.latencyMs > 0 ? `${health.latencyMs}ms` : "—"}
          </span>
        </button>
      </PopoverTrigger>

      {/* Issue #738: Popover showing per-network latency and last-checked timestamp */}
      <PopoverContent side="bottom" align="start" className="w-64 text-sm">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold uppercase text-xs tracking-wider text-muted-foreground">
              RPC Status
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                health.status === "healthy" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                health.status === "degraded" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                health.status === "offline" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
              )}
            >
              {health.status}
            </span>
          </div>

          <div className="divide-y rounded-md border text-xs">
            <div className="flex justify-between px-3 py-2">
              <span className="text-muted-foreground">Network</span>
              <span className="font-medium capitalize">{currentNetwork}</span>
            </div>
            <div className="flex justify-between px-3 py-2">
              <span className="text-muted-foreground">Latency (p50)</span>
              <span className="font-mono font-medium">
                {health.latencyMs > 0 ? `${health.latencyMs}ms` : "—"}
              </span>
            </div>
            <div className="flex justify-between px-3 py-2">
              <span className="text-muted-foreground">Latency graph</span>
              <span className="font-mono text-[10px] tracking-tight">
                {latencyHistory.map((h, i) => (
                  <span key={i} className="mx-0.5" title={`${h}ms`}>
                    {h > 2000 ? "█" : h > 1000 ? "▅" : h > 500 ? "▄" : "▂"}
                  </span>
                ))}
              </span>
            </div>
            <div className="flex justify-between px-3 py-2">
              <span className="text-muted-foreground">Latest ledger</span>
              <span className="font-mono font-medium">
                {health.latestLedger > 0 ? health.latestLedger.toLocaleString() : "—"}
              </span>
            </div>
            <div className="flex justify-between px-3 py-2">
              <span className="text-muted-foreground">Last checked</span>
              <span className="font-mono font-medium">
                {new Date(health.lastCheck).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {health.status === "degraded" && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              Latency above 2000ms threshold. Write transactions may fail.
            </p>
          )}
          {health.status === "offline" && (
            <p className="text-xs text-red-600 dark:text-red-400">
              RPC endpoint unreachable. Check your network connection or switch networks.
            </p>
          )}

          <div className="flex items-center justify-between border-t pt-3">
            <div className="space-y-0.5">
              <span className="text-xs font-medium">Auto-failover</span>
              <p className="text-[10px] text-muted-foreground">
                {autoFailover ? `Switches to ${failoverNetworkId} at &gt;${degradationThresholdMs}ms` : "Off"}
              </p>
            </div>
            <Switch
              checked={autoFailover}
              onCheckedChange={setAutoFailover}
              aria-label="Toggle auto-failover"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
