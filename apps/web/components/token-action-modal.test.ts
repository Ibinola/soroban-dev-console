import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * W7-FE-003: Unit tests for the SAC token action builder covering all four
 * actions (transfer, burn, mint, clawback).
 *
 * These verify the wiring (correct action name + arg shape) without
 * actually invoking the Stellar SDK or RPC. We mock the SDK primitives
 * so address checksum encoding never blocks the test runner.
 */

// --- Mock @stellar/stellar-sdk primitives so we can verify call sites. ---
const { callSpy, nativeToScValSpy } = vi.hoisted(() => ({
  callSpy: vi.fn((fnName: string, ...args: unknown[]) => ({
    type: "invokeHostFunction",
    fn: fnName,
    args,
  })),
  nativeToScValSpy: vi.fn((v: unknown) => ({ native: v })),
}));

vi.mock("@stellar/stellar-sdk", () => ({
  Contract: vi.fn().mockImplementation(() => ({ call: callSpy })),
  TransactionBuilder: vi.fn(),
  TimeoutInfinite: 0,
  Operation: class {},
  nativeToScVal: nativeToScValSpy,
  StrKey: {
    isValidEd25519PublicKey: vi.fn().mockReturnValue(true),
  },
  rpc: { Server: vi.fn() },
}));

// --- Mock the wallet / network / orchestrator / toast stack. ---
vi.mock("@/lib/wallet/provider", () => ({
  walletProviders: {},
  walletProviderList: [],
  assertCapability: vi.fn(),
}));

vi.mock("@/store/useWallet", () => ({
  useWallet: () => ({
    address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    isConnected: true,
  }),
}));

vi.mock("@/store/useNetworkStore", () => ({
  useNetworkStore: () => ({
    getActiveNetworkConfig: () => ({
      rpcUrl: "https://mock.rpc",
      networkPassphrase: "Mock Network ; 2024",
    }),
  }),
}));

vi.mock("@/lib/tx-orchestrator", () => ({
  orchestrateTx: vi.fn(),
}));

vi.mock("@/lib/error-decoder", () => ({
  decodeError: (raw: string) => ({
    category: "unknown",
    summary: "Unknown error",
    detail: raw,
    raw,
  }),
  formatErrorForDisplay: (d: { summary: string; detail: string }) =>
    `[${d.summary}] ${d.detail}`,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

// Import after mocks.
import { Contract } from "@stellar/stellar-sdk";
import { buildSacOperation, type TokenAction } from "./token-action-modal";

const FROM = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const TO = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

describe("buildSacOperation (W7-FE-003)", () => {
  beforeEach(() => {
    callSpy.mockClear();
    nativeToScValSpy.mockClear();
  });

  it.each<[TokenAction, number]>([
    ["transfer", 3],
    ["burn", 2],
    ["mint", 2],
    ["clawback", 2],
  ])(
    "emits a %s operation with %i SCVal args",
    (action, expectedArgs) => {
      const op = buildSacOperation(
        new Contract("C"),
        action,
        FROM,
        TO,
        BigInt(1),
      );

      expect(op).toBeDefined();
      expect(op.type).toBe("invokeHostFunction");
      // Confirm the SDK was called with the matching action + arity.
      expect(callSpy).toHaveBeenCalledTimes(1);
      const [fnName, ...args] = callSpy.mock.calls[0];
      expect(fnName).toBe(action);
      expect(args.length).toBe(expectedArgs);
      // Each arg must have gone through nativeToScVal.
      expect(nativeToScValSpy).toHaveBeenCalledTimes(expectedArgs);
    },
  );

  it("throws on unknown action", () => {
    expect(() =>
      buildSacOperation(
        new Contract("C"),
        "bogus" as unknown as TokenAction,
        FROM,
        TO,
        BigInt(1),
      ),
    ).toThrow(/Unknown token action/);
  });
});
