import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ContractEvents } from "./contract-events";

// Hoisted so the mock factory can use the same instance across tests.
const serverInstance = vi.hoisted(() => ({ getEvents: vi.fn() }));

vi.mock("@stellar/stellar-sdk", () => {
  return {
    rpc: {
      Server: vi.fn().mockImplementation(() => serverInstance),
    },
    Contract: vi.fn(),
    TransactionBuilder: vi.fn(),
    SorobanDataBuilder: vi.fn(),
    Account: vi.fn(),
    Keypair: vi.fn(),
    Asset: vi.fn(),
  };
});

vi.mock("@/store/useNetworkStore", () => {
  return {
    useNetworkStore: () => ({
      getActiveNetworkConfig: () => ({
        id: "testnet",
        name: "Testnet",
        rpcUrl: "http://test.local/soroban/rpc",
        networkPassphrase: "Test SDF Network ; September 2015",
        horizonUrl: "http://test.local",
      }),
    }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/contracts/ABC",
  useSearchParams: () => new URLSearchParams(),
}));

const CONTRACT_ID = "CABC123";

const PAGE_SIZE = 20;

function buildEventResponse(
  ids: string[],
  cursorSuffix = "cursor-next",
  ledger = 100,
) {
  return {
    events: ids.map((id, i) => ({
      id,
      type: "contract",
      ledger,
      ledgerClosedAt: "2024-01-01T00:00:00Z",
      transactionIndex: i,
      operationIndex: i,
      inSuccessfulContractCall: true,
      txHash: `tx-${id}`,
      contractId: CONTRACT_ID,
      topic: [
        {
          switch: () => ({ name: () => "scvSymbol" }),
          sym: () => "transfer",
        },
      ],
      value: { switch: () => ({ name: () => "scvVoid" }) },
    })),
    cursor: cursorSuffix,
    latestLedger: ledger,
    latestLedgerCloseTime: "2024-01-01T00:00:00Z",
    oldestLedger: ledger - 100,
    oldestLedgerCloseTime: "2024-01-01T00:00:00Z",
  };
}

function pageOfEvents(prefix: string): string[] {
  return Array.from({ length: PAGE_SIZE }, (_, i) => `${prefix}-${i}`);
}

describe("ContractEvents (W7-FE / #679)", () => {
  beforeEach(() => {
    serverInstance.getEvents.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the initial page, copies the cursor into the footer, and enables Load more", async () => {
    serverInstance.getEvents.mockResolvedValueOnce(
      buildEventResponse(pageOfEvents("p1"), "cursor-next-1", 4321),
    );

    render(<ContractEvents contractId={CONTRACT_ID} />);

    // Event count and cursor footer appear after the first fetch resolves.
    await screen.findByText(/20 events/i, {}, { timeout: 3000 });
    expect(
      await screen.findByText(/Cursor: cursor-next-1/i, {}, { timeout: 1000 }),
    ).toBeInTheDocument();

    // The Load more button must be present and enabled when hasMore is true.
    const loadMore = screen.getByRole("button", { name: /load more/i });
    expect(loadMore).toBeEnabled();
  });

  it("uses the previous cursor when Load more is clicked", async () => {
    serverInstance.getEvents.mockResolvedValueOnce(
      buildEventResponse(pageOfEvents("p1"), "cursor-next-1", 1111),
    );
    serverInstance.getEvents.mockResolvedValueOnce(
      buildEventResponse(pageOfEvents("p2"), "cursor-next-2", 2222),
    );

    render(<ContractEvents contractId={CONTRACT_ID} />);

    await screen.findByText(/Cursor: cursor-next-1/i, {}, { timeout: 3000 });

    const callsBefore = serverInstance.getEvents.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    // Wait for the second fetch to be issued.
    await waitFor(
      () => {
        expect(serverInstance.getEvents.mock.calls.length).toBeGreaterThan(
          callsBefore,
        );
      },
      { timeout: 3000 },
    );

    // The second fetch must carry the cursor returned by the first page.
    const lastCall =
      serverInstance.getEvents.mock.calls[
        serverInstance.getEvents.mock.calls.length - 1
      ];
    expect(lastCall?.[0]).toMatchObject({
      cursor: "cursor-next-1",
      limit: PAGE_SIZE,
    });
  });
});
