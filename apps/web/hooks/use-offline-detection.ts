"use client";

import { useEffect, useState } from "react";
import { useSyncQueueStore } from "@/store/useSyncQueueStore";

/**
 * Issue #745: Offline mode detection using navigator.onLine and online/offline events.
 *
 * Returns the current online status and auto-replays the sync queue when
 * the connection is restored.
 */
export function useOfflineDetection() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const { flush, pendingCount } = useSyncQueueStore();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Issue #745: Auto-replay buffered mutations when connection restores
      if (pendingCount() > 0) {
        flush();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flush, pendingCount]);

  return { isOnline };
}
