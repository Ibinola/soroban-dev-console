"use client";

import { useNetworkStore } from "@/store/useNetworkStore";
import { AlertTriangle, WifiOff, RefreshCw } from "lucide-react";

/**
 * Shows a sticky banner when the active network is degraded or offline.
 * Write flows should check `health.status` before submitting transactions.
 */
export function NetworkDegradedBanner() {
  const { health, currentNetwork, setNetwork } = useNetworkStore();

  if (!health || health.status === "healthy") return null;

  const isDegraded = health.status === "degraded";

  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium ${
        isDegraded
          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
      }`}
    >
      <div className="flex items-center gap-2">
        {isDegraded ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0" />
        )}
        <span>
          {isDegraded
            ? `Network degraded (${health.latencyMs}ms) — write transactions may fail.`
            : "Network offline — read-only mode active. Switch network or retry."}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isDegraded && currentNetwork !== "mainnet" && (
          <button
            onClick={() => setNetwork("mainnet")}
            className="underline underline-offset-2 hover:no-underline"
          >
            Switch to Mainnet
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1 underline underline-offset-2 hover:no-underline"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    </div>
  );
}
