"use client";

import { useEffect } from "react";
import { useNetworkStore } from "@/store/useNetworkStore";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@devconsole/ui";
import { cn } from "@devconsole/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function NetworkHealth() {
  const { currentNetwork, health, setHealth } = useNetworkStore();

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const res = await fetch(`${API_BASE}/health/networks/${currentNetwork}`);
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

  const statusColors = {
    healthy: "bg-green-500",
    degraded: "bg-yellow-500",
    offline: "bg-red-500",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex cursor-help items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted">
            <div
              className={cn(
                "h-2 w-2 animate-pulse rounded-full",
                statusColors[health.status],
              )}
            />
            <span className="hidden font-mono text-xs text-muted-foreground lg:inline">
              {health.latencyMs}ms
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="space-y-1 text-xs">
          <p className="font-bold uppercase">{health.status}</p>
          <p>Ledger: {health.latestLedger}</p>
          <p className="text-[10px] opacity-70">
            Last check: {new Date(health.lastCheck).toLocaleTimeString()}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
