"use client";

import { useEffect } from "react";
import { useNetworkStore } from "@/store/useNetworkStore";
import { AlertTriangle, WifiOff, RefreshCw } from "lucide-react";
import { useOfflineDetection } from "@/hooks/use-offline-detection";
import { toast } from "sonner";

/**
 * Shows a sticky banner when the active network is degraded, offline, or the
 * browser itself is offline.
 *
 * Issue #745: Detects browser offline state via navigator.onLine and
 * online/offline events. When offline, shows a persistent banner, disables
 * API-dependent features, and auto-replays the sync queue on reconnect.
 *
 * Write flows should check `health.status` before submitting transactions.
 */
export function NetworkDegradedBanner() {
  const { health, currentNetwork, setNetwork, autoFailover, failoverNetworkId, degradationThresholdMs } = useNetworkStore();
  const { isOnline } = useOfflineDetection();

  // Issue #745: Browser is completely offline
  const isBrowserOffline = !isOnline;

  // Auto-failover: switch to fallback network when degraded above threshold
  useEffect(() => {
    if (autoFailover && health?.status === "degraded" && health.latencyMs >= degradationThresholdMs && currentNetwork !== failoverNetworkId) {
      setNetwork(failoverNetworkId);
      toast.info(`Auto-failover switched to ${failoverNetworkId} due to high latency (${health.latencyMs}ms)`);
    }
  }, [autoFailover, health, currentNetwork, failoverNetworkId, degradationThresholdMs, setNetwork]);

  if (!isBrowserOffline && (!health || health.status === "healthy")) return null;

  const isDegraded = !isBrowserOffline && health?.status === "degraded";
  const isNetworkOffline = isBrowserOffline || health?.status === "offline";

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
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
          {isBrowserOffline
            ? "You're offline — workspace changes are being saved locally and will sync when you reconnect."
            : isDegraded
            ? `Network degraded (${health?.latencyMs}ms) — write transactions may fail.${autoFailover ? ` Auto-failover will switch at ${degradationThresholdMs}ms.` : ""}`
            : "Network offline — read-only mode active. Switch network or retry."}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Issue #745: Disable API-dependent actions with tooltip when offline */}
        {isBrowserOffline ? (
          <span
            className="cursor-not-allowed text-xs opacity-60"
            title="Unavailable offline"
          >
            Sync paused
          </span>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
