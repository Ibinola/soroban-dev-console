import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock the SDK barrel so Address / Contract / nativeToScVal work with any
// string. This avoids depending on getRandomValues / Keypair.random() in
// jsdom and keeps the test focused on the wiring, not on the SDK's own
// validation.
vi.mock("@stellar/stellar-sdk", async () => {
  const real = await vi.importActual<typeof import("@stellar/stellar-sdk")>(
    "@stellar/stellar-sdk",
  );

  // Chainable TransactionBuilder stub.
  const builtXdr = "mock-tx-xdr";
  const TransactionBuilderMock = vi.fn().mockImplementation(() => {
    const builder: Record<string, unknown> = {};
    builder.addOperation = vi.fn().mockReturnValue(builder);
    builder.setTimeout = vi.fn().mockReturnValue(builder);
    builder.build = vi.fn().mockReturnValue({
      toXDR: vi.fn().mockReturnValue(builtXdr),
    });
    return builder;
  });

  return {
    ...real,
    StrKey: {
      ...real.StrKey,
      isValidEd25519PublicKey: () => true,
      isValidContract: () => true,
    },
    Address: vi.fn().mockImplementation((s: string) => ({
      toScVal: () => ({ __mockAddr: s }),
      toString: () => s,
    })),
    Contract: vi.fn().mockImplementation((id: string) => ({
      call: vi.fn().mockImplementation((...callArgs: unknown[]) => {
        const method = (callArgs[0] as string) ?? "unknown";
        return {
          __mockOp: true,
          id,
          method,
          toXDR: () => `${id}|${method}`,
        };
      }),
    })),
    nativeToScVal: vi.fn().mockImplementation((v: unknown) => ({ __v: v })),
    TransactionBuilder: TransactionBuilderMock,
    TimeoutInfinite: 0 as unknown as bigint,
    Operation: real.Operation,
  };
});

// Mock the SDK RPC Server so the modal never opens a real socket.
vi.mock("@stellar/stellar-sdk/rpc", () => ({
  Server: vi.fn().mockImplementation(() => ({
    getAccount: vi.fn().mockResolvedValue({
      accountId: () => "G-MOCK-PK",
      sequenceNumber: () => "0",
      incrementSequenceNumber: () => undefined,
    }),
  })),
}));

vi.mock("@stellar/freighter-api", () => ({
  signTransaction: vi.fn(),
}));

const mockWallet = {
  isConnected: true,
  address: "G-MOCK-ADMIN",
  isSandboxMode: false,
};

const mockUseWallet = vi.fn(() => mockWallet);

vi.mock("@/store/useWallet", () => ({
  useWallet: (...args: unknown[]) => mockUseWallet(...args),
}));

vi.mock("@/store/useNetworkStore", () => ({
  useNetworkStore: () => ({
    getActiveNetworkConfig: () => ({
      id: "testnet",
      name: "Testnet",
      rpcUrl: "http://localhost:8000/soroban/rpc",
      networkPassphrase: "Test SDF Network ; September 2015",
    }),
  }),
}));

const mockOrchestrate = vi.fn();
vi.mock("@/lib/tx-orchestrator", () => ({
  orchestrateTx: (...args: unknown[]) =>
    (mockOrchestrate as unknown as (...a: unknown[]) => unknown)(...args),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

// Import after mocks.
import { TokenActionModal } from "./token-action-modal";

describe("<TokenActionModal /> — W7-FE-003 wiring", () => {
  beforeEach(() => {
    mockUseWallet.mockImplementation(() => mockWallet);
    mockOrchestrate.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-positive amounts without invoking orchestrator", async () => {
    render(
      <TokenActionModal
        open
        onOpenChange={vi.fn()}
        action="transfer"
        contractId="C-MOCK-CONTRACT"
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Recipient Address/i), {
      target: { value: "G-MOCK-RECIPIENT" },
    });
    fireEvent.change(screen.getByLabelText(/Amount/i), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Transfer Tokens/i }));

    await waitFor(() => {
      expect(mockOrchestrate).not.toHaveBeenCalled();
    });
  });

  it("invokes orchestrateTx and surfaces success", async () => {
    mockOrchestrate.mockResolvedValue({
      status: "success",
      hash: "deadbeef" + "0".repeat(56),
    });

    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <TokenActionModal
        open
        onOpenChange={onOpenChange}
        action="transfer"
        contractId="C-MOCK-CONTRACT"
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Recipient Address/i), {
      target: { value: "G-MOCK-RECIPIENT" },
    });
    fireEvent.change(screen.getByLabelText(/Amount/i), {
      target: { value: "1500" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Transfer Tokens/i }));

    await waitFor(
      () => {
        expect(mockOrchestrate).toHaveBeenCalledTimes(1);
      },
      { timeout: 5000 },
    );

    const xdrArg = mockOrchestrate.mock.calls[0]?.[0];
    expect(typeof xdrArg).toBe("string");
    expect((xdrArg as string).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(expect.stringMatching(/^dead/));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("propagates an error result from the orchestrator", async () => {
    mockOrchestrate.mockResolvedValue({
      status: "error",
      errorMessage: "simulation failed: auth required",
    });

    render(
      <TokenActionModal
        open
        onOpenChange={vi.fn()}
        action="burn"
        contractId="C-MOCK-CONTRACT"
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Amount/i), {
      target: { value: "42" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Burn Tokens/i }));

    await waitFor(
      () => {
        expect(mockOrchestrate).toHaveBeenCalledTimes(1);
      },
      { timeout: 5000 },
    );
  });

  it("requires a recipient for transfer, mint and clawback", async () => {
    render(
      <TokenActionModal
        open
        onOpenChange={vi.fn()}
        action="mint"
        contractId="C-MOCK-CONTRACT"
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Amount/i), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Mint Tokens/i }));

    await waitFor(() => {
      expect(mockOrchestrate).not.toHaveBeenCalled();
    });
  });

  it("refuses to submit when no wallet is connected and sandbox is off", async () => {
    mockUseWallet.mockImplementation(
      () =>
        ({
          isConnected: false,
          address: null as unknown as string,
          isSandboxMode: false,
        }) as ReturnType<typeof mockUseWallet>,
    );

    render(
      <TokenActionModal
        open
        onOpenChange={vi.fn()}
        action="transfer"
        contractId="C-MOCK-CONTRACT"
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Recipient Address/i), {
      target: { value: "G-MOCK-RECIPIENT" },
    });
    fireEvent.change(screen.getByLabelText(/Amount/i), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Transfer Tokens/i }));

    await waitFor(() => {
      expect(mockOrchestrate).not.toHaveBeenCalled();
    });
  });
});
