/**
 * FE-035: Workspace activity timeline store.
 * Records local domain events (create, sync, share, fork, import, checkpoint)
 * and surfaces them in chronological order alongside remote audit entries.
 *
 * Issue #744: Polls GET /api/audit?resourceId=<workspaceId> every 30 seconds.
 * Uses Page Visibility API to pause polling when the tab is backgrounded.
 * New entries since last poll are briefly highlighted.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

const API_BASE =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:3001";

const POLL_INTERVAL_MS = 30_000;

export type ActivityEventKind =
  | "workspace_created"
  | "workspace_synced"
  | "workspace_imported"
  | "share_created"
  | "share_revoked"
  | "workspace_forked"
  | "checkpoint_created"
  | "note_added"
  | "contract_added"
  | "remote_audit"; // entries fetched from the backend audit trail

export interface ActivityEvent {
  id: string;
  workspaceId: string;
  kind: ActivityEventKind;
  label: string;
  /** Optional link to a related resource (share token, contract id, etc.) */
  resourceRef?: string;
  /** "local" = recorded in-browser; "remote" = from backend audit trail */
  source: "local" | "remote";
  timestamp: number;
  /** Issue #744: Temporarily true for entries just fetched from the server */
  isNew?: boolean;
}

interface WorkspaceActivityState {
  events: ActivityEvent[];
  /** Issue #744: IDs of recently-fetched remote entries (for highlight) */
  newEntryIds: Set<string>;
  record: (workspaceId: string, kind: ActivityEventKind, label: string, resourceRef?: string) => void;
  /** Merge remote audit entries (deduplicates by id) */
  mergeRemote: (entries: ActivityEvent[]) => void;
  getTimeline: (workspaceId: string) => ActivityEvent[];
  clearForWorkspace: (workspaceId: string) => void;
  /** Issue #744: Start polling for a workspace's remote activity */
  pollForWorkspace: (workspaceId: string) => () => void;
}

/** Map from workspaceId to the active polling interval handle. */
const activePolls: Map<string, ReturnType<typeof setInterval>> = new Map();

async function fetchRemoteActivity(workspaceId: string): Promise<ActivityEvent[]> {
  try {
    const ownerKey =
      typeof window !== "undefined"
        ? localStorage.getItem("owner-key") ?? "default-dev-key"
        : "default-dev-key";

    const res = await fetch(
      `${API_BASE}/api/audit?resourceId=${encodeURIComponent(workspaceId)}&resourceType=workspace&limit=50`,
      {
        headers: {
          "content-type": "application/json",
          "x-owner-key": ownerKey,
        },
      },
    );

    if (!res.ok) return [];

    const body = await res.json() as { data?: { id: string; action: string; actor: string; createdAt: string }[]; pagination?: unknown };
    const rows = body?.data ?? [];

    return rows.map((row) => ({
      id: row.id,
      workspaceId,
      kind: "remote_audit" as ActivityEventKind,
      label: row.action,
      resourceRef: row.actor,
      source: "remote" as const,
      timestamp: new Date(row.createdAt).getTime(),
    }));
  } catch {
    return [];
  }
}

export const useWorkspaceActivityStore = create<WorkspaceActivityState>()(
  persist(
    (set, get) => ({
      events: [],
      newEntryIds: new Set(),

      record: (workspaceId, kind, label, resourceRef) =>
        set((state) => ({
          events: [
            {
              id: crypto.randomUUID(),
              workspaceId,
              kind,
              label,
              resourceRef,
              source: "local",
              timestamp: Date.now(),
            },
            ...state.events,
          ],
        })),

      mergeRemote: (entries) =>
        set((state) => {
          const existingIds = new Set(state.events.map((e) => e.id));
          const newEntries = entries.filter((e) => !existingIds.has(e.id));
          if (newEntries.length === 0) return state;

          // Issue #744: Mark newly fetched entries for highlight
          const newIds = new Set(newEntries.map((e) => e.id));
          // Clear highlight after 5 seconds
          if (typeof window !== "undefined") {
            setTimeout(() => {
              useWorkspaceActivityStore.setState({ newEntryIds: new Set() });
            }, 5_000);
          }

          return {
            events: [...state.events, ...newEntries].sort((a, b) => b.timestamp - a.timestamp),
            newEntryIds: newIds,
          };
        }),

      getTimeline: (workspaceId) =>
        get()
          .events.filter((e) => e.workspaceId === workspaceId)
          .sort((a, b) => b.timestamp - a.timestamp),

      clearForWorkspace: (workspaceId) =>
        set((state) => ({
          events: state.events.filter((e) => e.workspaceId !== workspaceId),
        })),

      /**
       * Issue #744: Start polling remote audit entries for a workspace.
       * Returns a cleanup function to stop polling.
       * Automatically pauses when the tab is hidden (Page Visibility API).
       */
      pollForWorkspace: (workspaceId) => {
        // Stop any existing poll for this workspace
        const existing = activePolls.get(workspaceId);
        if (existing) clearInterval(existing);

        const doPoll = async () => {
          // Issue #744: Pause when tab is backgrounded
          if (typeof document !== "undefined" && document.visibilityState === "hidden") {
            return;
          }
          const entries = await fetchRemoteActivity(workspaceId);
          if (entries.length > 0) {
            get().mergeRemote(entries);
          }
        };

        // Initial fetch
        void doPoll();

        const intervalId = setInterval(doPoll, POLL_INTERVAL_MS);
        activePolls.set(workspaceId, intervalId);

        return () => {
          clearInterval(intervalId);
          activePolls.delete(workspaceId);
        };
      },
    }),
    {
      name: "soroban-workspace-activity",
      // Keep at most 500 events to avoid unbounded localStorage growth
      partialize: (state) => ({ events: state.events.slice(0, 500) }),
    },
  ),
);
