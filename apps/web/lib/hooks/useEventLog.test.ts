import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useEventLog } from "@/lib/hooks/useEventLog";
import { useNetworkStore } from "@/store/useNetworkStore";

// Mock the API gateway so we don't have to spin up a real backend. The hook
// tries the gateway first; on NETWORK_ERROR / HTTP_ERROR it falls back to
// the direct Soroban RPC server.
vi.mock("@/lib/api/rpc-gateway", async () => {
  return {
    sorobanRpc: {
      getEvents: vi.fn(),
    },
    RpcGatewayError: class RpcGatewayError extends Error {
      constructor(
        message: string,
        public code?: string,
      ) {
        super(message);
        this.name = "RpcGatewayError";
      }
    },
  };
});

import { sorobanRpc, RpcGatewayError } from "@/lib/api/rpc-gateway";

// Mock the Stellar RPC Server fallback path as well — the SDK calls
// `new SorobanRpc.Server(url).getEvents(...)` once we exhaust the gateway.
vi.mock("@stellar/stellar-sdk", () => ({
  rpc: {
    Server: vi.fn().mockImplementation(() => ({
      getEvents: vi.fn(),
    })),
  },
}));

import { rpc as SorobanRpc } from "@stellar/stellar-sdk";

function makeEvents(ids: string[], baseLedger = 100): any[] {
  return ids.map((id, idx) => ({
    id,
    type: "contract",
    topic: ["AAA", "BBB"],
    value: "AAAA",
    ledger: baseLedger + idx,
    ledgerClosedAt: "2026-07-23T00:00:00Z",
  }));
}

function makeResponse(events: any[], cursor?: string) {
  return {
    events,
    latestLedger: events.at(-1)?.ledger ?? 0,
    cursor: cursor ?? undefined,
  };
}

describe("useEventLog (#679)", () => {
  beforeEach(() => {
    useNetworkStore.setState({
      currentNetwork: "testnet",
      customNetworks: [],
      health: null,
    });
    vi.mocked(sorobanRpc.getEvents).mockReset();
    vi.mocked(SorobanRpc.Server as any).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("performs an initial fetch and emits zero events when the RPC returns none", async () => {
    vi.mocked(sorobanRpc.getEvents).mockResolvedValueOnce(
      makeResponse([]) as any,
    );

    const { result } = renderHook(() => useEventLog({ contractId: "CABC123" }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.lastRefreshedAt).not.toBeNull();
  });

  it("paginates via cursor when loadMore is called", async () => {
    vi.mocked(sorobanRpc.getEvents)
      // Initial page: 2 events, cursor available
      .mockResolvedValueOnce(
        makeResponse(makeEvents(["e1", "e2"]), "cursor-next") as any,
      )
      // The setCursor callback has now updated React state. Then "load more"
      // arrives — same cursor.
      .mockImplementationOnce(async (_net, req: any) => {
        expect(req.cursor).toBe("cursor-next");
        return makeResponse(makeEvents(["e3", "e4"], 102)) as any;
      });

    const { result } = renderHook(() => useEventLog({ contractId: "CABC123" }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totalCount).toBe(2);
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.totalCount).toBe(4);
  });

  it("defaults to polling OFF", async () => {
    vi.mocked(sorobanRpc.getEvents).mockResolvedValue(
      makeResponse(makeEvents(["e1"])) as any,
    );

    const { result } = renderHook(() => useEventLog({ contractId: "CABC123" }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pollInterval).toBe("off");

    const callCountAfterMount = vi.mocked(sorobanRpc.getEvents).mock.calls
      .length;

    // Wait a beat to make sure no extra fetches happen.
    await new Promise((r) => setTimeout(r, 40));
    expect(vi.mocked(sorobanRpc.getEvents).mock.calls.length).toBe(
      callCountAfterMount,
    );
  });

  it(
    "highlights fresh polled events with their ids in freshIds",
    { timeout: 20_000 },
    async () => {
      // Use real timers with the smallest valid poll interval (5_000ms).
      // The test timeout is bumped so a single poll tick can fire.
      vi.mocked(sorobanRpc.getEvents)
        .mockResolvedValueOnce(makeResponse(makeEvents(["e1"])) as any)
        .mockResolvedValueOnce(
          makeResponse([
            ...makeEvents(["new-hot"], 200),
            { ...makeEvents(["e1"])[0] },
          ]) as any,
        );

      const SHORT_POLL_MS = 5_000;
      const { result } = renderHook(() =>
        useEventLog({
          contractId: "CABC123",
          initialPollInterval: "off",
        }),
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.totalCount).toBe(1);
      expect(vi.mocked(sorobanRpc.getEvents).mock.calls.length).toBe(1);

      // useState(initialValue) only reads on mount — flip the polling
      // knob through the hook's own setter, not by rerendering with
      // a different prop.
      act(() => {
        result.current.setPollInterval(SHORT_POLL_MS);
      });

      await waitFor(
        () => {
          expect(
            vi.mocked(sorobanRpc.getEvents).mock.calls.length,
          ).toBeGreaterThanOrEqual(2);
        },
        { timeout: SHORT_POLL_MS + 4_000, interval: 100 },
      );

      await waitFor(
        () => {
          expect(result.current.freshIds.has("new-hot")).toBe(true);
          expect(result.current.totalCount).toBe(2);
        },
        { timeout: 4_000, interval: 50 },
      );
    },
  );

  it("resets state when contractId changes", async () => {
    vi.mocked(sorobanRpc.getEvents).mockResolvedValue(
      makeResponse(makeEvents(["e1"])) as any,
    );

    const { result, rerender } = renderHook(
      ({ id }) => useEventLog({ contractId: id }),
      { initialProps: { id: "CONTRACT-A" } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totalCount).toBe(1);

    rerender({ id: "CONTRACT-B" });
    await waitFor(() => expect(result.current.totalCount).toBe(0));
  });

  it("surfaces an error message when the gateway rejects with a non-transient error", async () => {
    const err = new RpcGatewayError("RPC rejected", "-32600");
    vi.mocked(sorobanRpc.getEvents).mockRejectedValueOnce(err);

    const { result } = renderHook(() => useEventLog({ contractId: "CABC123" }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("RPC rejected");
  });

  it("falls back to direct RPC when the gateway emits NETWORK_ERROR", async () => {
    const fallbackEvents = makeResponse(makeEvents(["fallback-1"]));
    vi.mocked(sorobanRpc.getEvents).mockRejectedValueOnce(
      new RpcGatewayError("network down", "NETWORK_ERROR"),
    );
    const serverInstance = {
      getEvents: vi.fn().mockResolvedValueOnce(fallbackEvents),
    };
    vi.mocked(SorobanRpc.Server as any).mockImplementationOnce(
      () => serverInstance,
    );

    const { result } = renderHook(() => useEventLog({ contractId: "CABC123" }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(SorobanRpc.Server).toHaveBeenCalled();
    expect(serverInstance.getEvents).toHaveBeenCalled();
    expect(result.current.totalCount).toBe(1);
    expect(result.current.events[0].id).toBe("fallback-1");
  });
});
