/**
 * Issue #742: Tests for the optimistic update pattern with rollback in
 * useSyncQueueStore.
 *
 * Covers:
 *  - applyOptimistic: mutation is enqueued with state "optimistic"
 *  - confirmOptimistic: mutation transitions to "confirmed" (with optional cloudId)
 *  - rollbackOptimistic: mutation transitions to "failed" with error reason
 *  - flush: successful path confirms and dequeues; conflict triggers rollback
 *  - isOptimistic / getOptimisticMutations selectors
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from "vitest";
import { useSyncQueueStore } from "./useSyncQueueStore";
import { workspacesApi } from "@/lib/api/workspaces";

// ── Mock the API client ───────────────────────────────────────────────────────
vi.mock("@/lib/api/workspaces", () => ({
  workspacesApi: {
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const mockCreate = workspacesApi.create as MockedFunction<typeof workspacesApi.create>;
const mockUpdate = workspacesApi.update as MockedFunction<typeof workspacesApi.update>;
const mockRemove = workspacesApi.remove as MockedFunction<typeof workspacesApi.remove>;

// ── Helpers ───────────────────────────────────────────────────────────────────
function resetStore() {
  useSyncQueueStore.setState({
    queue: [],
    flushStatus: "idle",
    staleSyncWarningDismissed: false,
  });
}

const baseMutation = {
  kind: "create" as const,
  localId: "local-abc",
  payload: { name: "My Workspace", contracts: [], interactions: [] },
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("useSyncQueueStore – optimistic update pattern (Issue #742)", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  // ── applyOptimistic ──────────────────────────────────────────────────────

  it("applyOptimistic enqueues a mutation with state 'optimistic'", () => {
    const id = useSyncQueueStore.getState().applyOptimistic(baseMutation);

    const { queue } = useSyncQueueStore.getState();
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe(id);
    expect(queue[0].mutationState).toBe("optimistic");
    expect(queue[0].kind).toBe("create");
    expect(queue[0].attempts).toBe(0);
  });

  it("applyOptimistic returns a unique id for each call", () => {
    const id1 = useSyncQueueStore.getState().applyOptimistic(baseMutation);
    const id2 = useSyncQueueStore.getState().applyOptimistic({ ...baseMutation, localId: "local-xyz" });

    expect(id1).not.toBe(id2);
    expect(useSyncQueueStore.getState().queue).toHaveLength(2);
  });

  // ── confirmOptimistic ────────────────────────────────────────────────────

  it("confirmOptimistic transitions state to 'confirmed'", () => {
    const id = useSyncQueueStore.getState().applyOptimistic(baseMutation);

    useSyncQueueStore.getState().confirmOptimistic(id);

    const entry = useSyncQueueStore.getState().queue.find((m) => m.id === id);
    expect(entry?.mutationState).toBe("confirmed");
  });

  it("confirmOptimistic updates cloudId when provided", () => {
    const id = useSyncQueueStore.getState().applyOptimistic(baseMutation);

    useSyncQueueStore.getState().confirmOptimistic(id, "cloud-999");

    const entry = useSyncQueueStore.getState().queue.find((m) => m.id === id);
    expect(entry?.mutationState).toBe("confirmed");
    expect(entry?.cloudId).toBe("cloud-999");
  });

  // ── rollbackOptimistic ───────────────────────────────────────────────────

  it("rollbackOptimistic transitions state to 'failed' with reason", () => {
    const id = useSyncQueueStore.getState().applyOptimistic(baseMutation);

    useSyncQueueStore.getState().rollbackOptimistic(id, "409 conflict");

    const entry = useSyncQueueStore.getState().queue.find((m) => m.id === id);
    expect(entry?.mutationState).toBe("failed");
    expect(entry?.lastError).toBe("409 conflict");
  });

  // ── isOptimistic / getOptimisticMutations ────────────────────────────────

  it("isOptimistic returns true while mutation is unconfirmed", () => {
    const id = useSyncQueueStore.getState().applyOptimistic(baseMutation);

    expect(useSyncQueueStore.getState().isOptimistic("local-abc")).toBe(true);

    useSyncQueueStore.getState().confirmOptimistic(id);
    expect(useSyncQueueStore.getState().isOptimistic("local-abc")).toBe(false);
  });

  it("getOptimisticMutations only returns unconfirmed entries", () => {
    const id1 = useSyncQueueStore.getState().applyOptimistic(baseMutation);
    const id2 = useSyncQueueStore.getState().applyOptimistic({ ...baseMutation, localId: "local-2" });

    useSyncQueueStore.getState().confirmOptimistic(id1);

    const optimistic = useSyncQueueStore.getState().getOptimisticMutations();
    expect(optimistic).toHaveLength(1);
    expect(optimistic[0].id).toBe(id2);
  });

  // ── flush: successful path ────────────────────────────────────────────────

  it("flush confirms and dequeues a 'create' mutation on success", async () => {
    mockCreate.mockResolvedValueOnce({ id: "cloud-1", name: "My Workspace" } as any);

    const cloudIdCallback = vi.fn();
    useSyncQueueStore.getState().applyOptimistic(baseMutation);

    await useSyncQueueStore.getState().flush(cloudIdCallback);

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(cloudIdCallback).toHaveBeenCalledWith("local-abc", "cloud-1");
    // After successful flush the mutation is dequeued
    expect(useSyncQueueStore.getState().queue).toHaveLength(0);
    expect(useSyncQueueStore.getState().flushStatus).toBe("idle");
  });

  it("flush confirms and dequeues an 'update' mutation on success", async () => {
    mockUpdate.mockResolvedValueOnce({ id: "cloud-1", name: "Updated" } as any);

    useSyncQueueStore.getState().applyOptimistic({
      kind: "update",
      localId: "local-abc",
      cloudId: "cloud-1",
      payload: { name: "Updated" },
    });

    await useSyncQueueStore.getState().flush();

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(useSyncQueueStore.getState().queue).toHaveLength(0);
  });

  it("flush confirms and dequeues a 'delete' mutation on success", async () => {
    mockRemove.mockResolvedValueOnce(undefined);

    useSyncQueueStore.getState().applyOptimistic({
      kind: "delete",
      localId: "local-abc",
      cloudId: "cloud-1",
    });

    await useSyncQueueStore.getState().flush();

    expect(mockRemove).toHaveBeenCalledWith("cloud-1");
    expect(useSyncQueueStore.getState().queue).toHaveLength(0);
  });

  // ── flush: conflict / rollback path ──────────────────────────────────────

  it("flush rolls back and sets flushStatus 'error' on a 409 conflict", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("409 conflict: revision mismatch"));

    const mutId = useSyncQueueStore.getState().applyOptimistic({
      kind: "update",
      localId: "local-abc",
      cloudId: "cloud-1",
      payload: { name: "Conflicted" },
    });

    await useSyncQueueStore.getState().flush();

    const entry = useSyncQueueStore.getState().queue.find((m) => m.id === mutId);
    expect(entry?.mutationState).toBe("failed");
    expect(entry?.lastError).toContain("409");
    expect(useSyncQueueStore.getState().flushStatus).toBe("error");
  });

  it("flush increments attempts on a non-conflict network error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Network error"));

    const mutId = useSyncQueueStore.getState().applyOptimistic(baseMutation);

    await useSyncQueueStore.getState().flush();

    const entry = useSyncQueueStore.getState().queue.find((m) => m.id === mutId);
    expect(entry?.attempts).toBe(1);
    expect(entry?.mutationState).toBe("optimistic");
    expect(useSyncQueueStore.getState().flushStatus).toBe("error");
  });

  // ── pendingCount ──────────────────────────────────────────────────────────

  it("pendingCount excludes confirmed mutations", () => {
    const id1 = useSyncQueueStore.getState().applyOptimistic(baseMutation);
    useSyncQueueStore.getState().applyOptimistic({ ...baseMutation, localId: "local-2" });

    expect(useSyncQueueStore.getState().pendingCount()).toBe(2);

    useSyncQueueStore.getState().confirmOptimistic(id1);
    expect(useSyncQueueStore.getState().pendingCount()).toBe(1);
  });
});
