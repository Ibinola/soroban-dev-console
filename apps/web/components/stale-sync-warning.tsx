"use client";

import { useEffect } from "react";
import { useSyncQueueStore } from "@/store/useSyncQueueStore";
import { AlertTriangle, X, RefreshCw } from "lucide-react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";

/**
 * Issue #755: Dismissible warning banner shown when workspace sync mutations
 * have been stuck in the queue for more than 24 hours.
 *
 * On app load, checks useSyncQueueStore for stale sync states and surfaces
 * a dismissible warning with a "Retry Sync" action.
 */
export function StaleSyncWarning() {
  const { hasStaleSync, dismissStaleSyncWarning, flush, pendingCount } = useSyncQueueStore();
  const { activeWorkspaceId } = useWorkspaceStore();

  const isStale = hasStaleSync();

  if (!isStale) return null;

  const handleRetry = async () => {
    await flush();
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          {pendingCount()} workspace change{pendingCount() !== 1 ? "s" : ""} have been stuck syncing for more than 24 hours.
        </span>
        <a
          href={`/?workspace=${activeWorkspaceId}`}
          className="underline underline-offset-2 hover:no-underline"
        >
          View workspace
        </a>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleRetry}
          className="flex items-center gap-1 underline underline-offset-2 hover:no-underline"
          aria-label="Retry sync"
        >
          <RefreshCw className="h-3 w-3" />
          Retry Sync
        </button>
        <button
          onClick={dismissStaleSyncWarning}
          className="rounded-full p-0.5 hover:bg-orange-200 dark:hover:bg-orange-800/50"
          aria-label="Dismiss stale sync warning"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
