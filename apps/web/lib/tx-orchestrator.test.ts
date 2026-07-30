/**
 * Issue #735: Tests for the SSE-based transaction status watcher with polling
 * fallback in tx-orchestrator.
 *
 * Covers:
 *  - SSE happy path: updates arrive and stream closes on terminal status
 *  - SSE connect timeout: falls back to polling
 *  - SSE onerror before first message: falls back to polling
 *  - No EventSource available: goes straight to polling
 *  - Polling fallback: calls POST /status, emits updates, stops on terminal
 *  - Cleanup function cancels both SSE and polling
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from "vitest";
import { watchTxStatus } from "./tx-orchestrator";
import type { NormalizedTransactionResult } from "@devconsole/api-contracts";

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_OPTIONS = {
  apiBase: "http://localhost:4000",
  sseConnectTimeoutMs: 100,
  pollIntervalMs: 50,
  maxPollAttempts: 10,
};

function makeResult(
  status: NormalizedTransactionResult["status"],
): NormalizedTransactionResult {
  return { status, hash: "abc123" };
}

function sseEnvelope(result: NormalizedTransactionResult): string {
  return JSON.stringify({ success: true, data: result });
}

// ── Mock EventSource ──────────────────────────────────────────────────────────

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  /** Helper to simulate a successful open */
  simulateOpen() {
    this.onopen?.();
  }

  /** Helper to emit a message */
  simulateMessage(data: string) {
    this.onmessage?.({ data });
  }

  /** Helper to simulate an error */
  simulateError() {
    this.onerror?.();
  }
}

// ── Mock fetch ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn() as MockedFunction<typeof fetch>;

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  MockEventSource.instances = [];
  vi.useFakeTimers();
  (globalThis as any).EventSource = MockEventSource;
  globalThis.fetch = mockFetch;
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as any).EventSource;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("watchTxStatus – SSE emission sequence (Issue #735)", () => {
  it("delivers 'pending' then 'success' updates and closes the SSE stream", async () => {
    const updates: NormalizedTransactionResult[] = [];
    const cleanup = watchTxStatus("testnet", "abc123", (r) => updates.push(r), BASE_OPTIONS);

    const es = MockEventSource.instances[0];
    expect(es).toBeDefined();

    // Open the connection
    es.simulateOpen();

    // First update: pending
    es.simulateMessage(sseEnvelope(makeResult("pending")));
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe("pending");

    // Second update: success — should close the stream
    es.simulateMessage(sseEnvelope(makeResult("success")));
    expect(updates).toHaveLength(2);
    expect(updates[1].status).toBe("success");
    expect(es.closed).toBe(true);

    cleanup();
  });

  it("closes the SSE stream on 'error' terminal status", async () => {
    const updates: NormalizedTransactionResult[] = [];
    watchTxStatus("testnet", "abc123", (r) => updates.push(r), BASE_OPTIONS);

    const es = MockEventSource.instances[0];
    es.simulateOpen();
    es.simulateMessage(sseEnvelope(makeResult("error")));

    expect(updates[0].status).toBe("error");
    expect(es.closed).toBe(true);
  });

  it("ignores malformed SSE data without throwing", () => {
    const updates: NormalizedTransactionResult[] = [];
    watchTxStatus("testnet", "abc123", (r) => updates.push(r), BASE_OPTIONS);

    const es = MockEventSource.instances[0];
    es.simulateOpen();
    es.simulateMessage("not-valid-json{{{{");

    expect(updates).toHaveLength(0);
  });
});

describe("watchTxStatus – SSE connect timeout fallback (Issue #735)", () => {
  it("falls back to polling when SSE does not open within the connect timeout", async () => {
    const pendingResult = makeResult("pending");
    const successResult = makeResult("success");

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: pendingResult }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: successResult }),
      } as any);

    const updates: NormalizedTransactionResult[] = [];
    const cleanup = watchTxStatus("testnet", "abc123", (r) => updates.push(r), BASE_OPTIONS);

    // SSE was opened but never called onopen — trigger the timeout
    expect(MockEventSource.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(BASE_OPTIONS.sseConnectTimeoutMs + 10);

    // The polling loop should have fired once immediately
    await vi.advanceTimersByTimeAsync(0); // flush microtasks
    expect(mockFetch).toHaveBeenCalled();

    cleanup();
  });
});

describe("watchTxStatus – SSE onerror fallback (Issue #735)", () => {
  it("falls back to polling when SSE emits onerror before first message", async () => {
    const successResult = makeResult("success");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: successResult }),
    } as any);

    const updates: NormalizedTransactionResult[] = [];
    watchTxStatus("testnet", "abc123", (r) => updates.push(r), BASE_OPTIONS);

    const es = MockEventSource.instances[0];
    // Trigger error before open
    es.simulateError();

    // The EventSource should be closed
    expect(es.closed).toBe(true);

    // Polling should have started — advance timers to let it fire
    await vi.advanceTimersByTimeAsync(10);
    expect(mockFetch).toHaveBeenCalled();
  });
});

describe("watchTxStatus – no EventSource available (polling fallback)", () => {
  it("uses polling directly when EventSource is not in the environment", async () => {
    delete (globalThis as any).EventSource;

    const successResult = makeResult("success");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: successResult }),
    } as any);

    const updates: NormalizedTransactionResult[] = [];
    watchTxStatus("testnet", "abc123", (r) => updates.push(r), BASE_OPTIONS);

    expect(MockEventSource.instances).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(10);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/rpc/testnet/status",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("watchTxStatus – polling fallback behaviour", () => {
  it("stops polling after reaching the maxPollAttempts limit", async () => {
    delete (globalThis as any).EventSource;

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: makeResult("pending") }),
    } as any);

    watchTxStatus("testnet", "abc123", () => {}, {
      ...BASE_OPTIONS,
      maxPollAttempts: 3,
    });

    // Each poll fires once per interval
    await vi.advanceTimersByTimeAsync(BASE_OPTIONS.pollIntervalMs * 10);

    // Should not exceed maxPollAttempts calls
    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("cleanup stops the polling loop immediately", async () => {
    delete (globalThis as any).EventSource;

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: makeResult("pending") }),
    } as any);

    const cleanup = watchTxStatus("testnet", "abc123", () => {}, BASE_OPTIONS);

    // First poll fires immediately
    await vi.advanceTimersByTimeAsync(10);
    const callsAfterFirst = mockFetch.mock.calls.length;

    cleanup();

    // After cleanup, no more polls should fire
    await vi.advanceTimersByTimeAsync(BASE_OPTIONS.pollIntervalMs * 5);
    expect(mockFetch.mock.calls.length).toBe(callsAfterFirst);
  });
});
