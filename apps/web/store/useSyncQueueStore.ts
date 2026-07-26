/**
 * FE-038: Offline-first sync queue for workspace mutations and retries.
 *
 * Queues workspace mutations when offline or during transient API failures.
 * Retries preserve ordering and avoid duplicate mutations.
 * Pending sync state is persisted and survives reloads.
 *
 * Issue #742: Adds optimistic update pattern with rollback on failure.
 * Mutations are applied immediately to local state (optimistic) and confirmed
 * or rolled back once the server responds.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CreateWorkspacePayload, UpdateWorkspacePayload } from "@devconsole/api-contracts";
import { workspacesApi } from "@/lib/api/workspaces";

export type MutationKind = "create" | "update" | "delete";

/** Issue #742: Tracks whether a queued mutation has been confirmed by the server. */
export type MutationState = "optimistic" | "confirmed" | "failed";

export interface QueuedMutation {
  id: string;
  kind: MutationKind;
  localId: string;
  cloudId?: string;
  payload?: CreateWorkspacePayload | UpdateWorkspacePayload;
  enqueuedAt: number;
  attempts: number;
  lastError?: string;
  /** Issue #742: tracks sync state of this individual mutation */
  mutationState: MutationState;
}

export type FlushStatus = "idle" | "flushing" | "error";

/** 24 hours in ms — mutations older than this are considered stale */
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

interface SyncQueueState {
  queue: QueuedMutation[];
  flushStatus: FlushStatus;
  /** Issue #755: Whether a stale sync warning banner has been dismissed */
  staleSyncWarningDismissed: boolean;

  enqueue: (mutation: Omit<QueuedMutation, "id" | "enqueuedAt" | "attempts" | "mutationState">) => string;
  /** Remove a mutation by id (e.g. after successful flush) */
  dequeue: (id: string) => void;
  /** Flush all pending mutations in order; stops on first unrecoverable error */
  flush: (onCloudIdResolved?: (localId: string, cloudId: string) => void) => Promise<void>;
  clearQueue: () => void;
  pendingCount: () => number;
  /** Issue #755: Returns true if there are mutations older than 24h that haven't been flushed */
  hasStaleSync: () => boolean;
  /** Issue #755: Dismiss the stale sync warning banner */
  dismissStaleSyncWarning: () => void;

  // ── Issue #742: Optimistic update API ──────────────────────────────────────

  /**
   * Apply a mutation optimistically: enqueue it and mark it as "optimistic".
   * Returns the mutation id so the caller can confirm or roll it back later.
   */
  applyOptimistic: (
    mutation: Omit<QueuedMutation, "id" | "enqueuedAt" | "attempts" | "mutationState">,
  ) => string;

  /**
   * Confirm a previously optimistic mutation (e.g. on server success).
   * Optionally updates the cloudId returned by the server (for "create" mutations).
   */
  confirmOptimistic: (mutationId: string, cloudId?: string) => void;

  /**
   * Roll back a previously optimistic mutation and mark it as failed.
   * The caller is responsible for reverting the local Zustand state.
   */
  rollbackOptimistic: (mutationId: string, reason: string) => void;

  /** Returns all mutations currently in the optimistic (unconfirmed) state */
  getOptimisticMutations: () => QueuedMutation[];

  /** Returns true if any mutation for the given localId is still optimistic */
  isOptimistic: (localId: string) => boolean;
}

const MAX_ATTEMPTS = 5;

export const useSyncQueueStore = create<SyncQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      flushStatus: "idle",
      staleSyncWarningDismissed: false,

      enqueue: (mutation) => {
        const id = crypto.randomUUID();
        set((state) => ({
          queue: [
            ...state.queue,
            { ...mutation, id, enqueuedAt: Date.now(), attempts: 0, mutationState: "optimistic" as MutationState },
          ],
          // Reset dismissed flag when new mutations are enqueued
          staleSyncWarningDismissed: false,
        }));
        return id;
      },

      dequeue: (id) =>
        set((state) => ({ queue: state.queue.filter((m) => m.id !== id) })),

      flush: async (onCloudIdResolved) => {
        const { queue } = get();
        if (queue.length === 0) return;

        set({ flushStatus: "flushing" });

        for (const mutation of [...queue]) {
          // Skip already confirmed, failed, or over-retried mutations
          if (mutation.mutationState === "confirmed") continue;
          if (mutation.attempts >= MAX_ATTEMPTS) continue;

          try {
            if (mutation.kind === "create" && mutation.payload) {
              const remote = await workspacesApi.create(
                mutation.payload as CreateWorkspacePayload,
              );
              onCloudIdResolved?.(mutation.localId, remote.id);
              get().confirmOptimistic(mutation.id, remote.id);
              get().dequeue(mutation.id);
            } else if (mutation.kind === "update" && mutation.cloudId && mutation.payload) {
              await workspacesApi.update(
                mutation.cloudId,
                mutation.payload as UpdateWorkspacePayload,
              );
              get().confirmOptimistic(mutation.id);
              get().dequeue(mutation.id);
            } else if (mutation.kind === "delete" && mutation.cloudId) {
              await workspacesApi.remove(mutation.cloudId);
              get().confirmOptimistic(mutation.id);
              get().dequeue(mutation.id);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";

            // Detect 409 Conflict — do not retry, roll back immediately
            const isConflict =
              err instanceof Error &&
              (err.message.includes("409") || err.message.includes("conflict") || err.message.includes("revision"));

            if (isConflict) {
              get().rollbackOptimistic(mutation.id, msg);
              set({ flushStatus: "error" });
              return;
            }

            set((state) => ({
              queue: state.queue.map((m) =>
                m.id === mutation.id
                  ? { ...m, attempts: m.attempts + 1, lastError: msg }
                  : m,
              ),
            }));
            // Stop flushing on network-level errors to preserve ordering
            set({ flushStatus: "error" });
            return;
          }
        }

        set({ flushStatus: "idle" });
      },

      clearQueue: () => set({ queue: [], flushStatus: "idle", staleSyncWarningDismissed: false }),

      pendingCount: () => get().queue.filter((m) => m.mutationState !== "confirmed").length,

      /** Issue #755: Returns true if any mutation is older than 24h and still pending */
      hasStaleSync: () => {
        const { queue, staleSyncWarningDismissed } = get();
        if (staleSyncWarningDismissed || queue.length === 0) return false;
        const cutoff = Date.now() - STALE_THRESHOLD_MS;
        return queue.some((m) => m.enqueuedAt < cutoff && m.mutationState !== "confirmed");
      },

      dismissStaleSyncWarning: () => set({ staleSyncWarningDismissed: true }),

      // ── Issue #742: Optimistic update implementation ───────────────────────

      applyOptimistic: (mutation) => {
        const id = crypto.randomUUID();
        set((state) => ({
          queue: [
            ...state.queue,
            {
              ...mutation,
              id,
              enqueuedAt: Date.now(),
              attempts: 0,
              mutationState: "optimistic" as MutationState,
            },
          ],
          staleSyncWarningDismissed: false,
        }));
        return id;
      },

      confirmOptimistic: (mutationId, cloudId) =>
        set((state) => ({
          queue: state.queue.map((m) =>
            m.id === mutationId
              ? {
                  ...m,
                  mutationState: "confirmed" as MutationState,
                  ...(cloudId ? { cloudId } : {}),
                }
              : m,
          ),
        })),

      rollbackOptimistic: (mutationId, reason) =>
        set((state) => ({
          queue: state.queue.map((m) =>
            m.id === mutationId
              ? { ...m, mutationState: "failed" as MutationState, lastError: reason }
              : m,
          ),
        })),

      getOptimisticMutations: () =>
        get().queue.filter((m) => m.mutationState === "optimistic"),

      isOptimistic: (localId) =>
        get().queue.some(
          (m) => m.localId === localId && m.mutationState === "optimistic",
        ),
    }),
    {
      name: "soroban-sync-queue",
      // Only persist the queue itself, not transient flush status
      partialize: (state) => ({ queue: state.queue, staleSyncWarningDismissed: state.staleSyncWarningDismissed }),
    },
  ),
);
