import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the third-party wallet libraries BEFORE importing the module under
// test so the provider's bindings are captured at module-init time.
vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  isAllowed: vi.fn(),
  setAllowed: vi.fn(),
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn(),
}));

vi.mock("@albedo-link/intent", () => ({
  default: {
    publicKey: vi.fn(),
    tx: vi.fn(),
  },
}));

import * as freighter from "@stellar/freighter-api";
import albedo from "@albedo-link/intent";
import { walletProviders, type WalletProviderId } from "@/lib/wallet/provider";

describe("wallet/provider — albedo regression (#651)", () => {
  beforeEach(() => {
    vi.mocked(albedo.publicKey).mockReset();
  });

  it("albedoRevalidate returns true when intent endpoint answers", async () => {
    vi.mocked(albedo.publicKey).mockResolvedValue({
      pubkey: "G".padEnd(56, "A"),
    } as any);
    await expect(walletProviders.albedo.revalidate()).resolves.toBe(true);
    expect(albedo.publicKey).toHaveBeenCalledTimes(1);
  });

  it("albedoRevalidate returns false when the user revoked the session", async () => {
    vi.mocked(albedo.publicKey).mockRejectedValue(
      new Error("intent rejected by user"),
    );
    await expect(walletProviders.albedo.revalidate()).resolves.toBe(false);
  });

  it("freeighter revalidation surfaces an existing connected address", async () => {
    vi.mocked(freighter.isConnected as any).mockResolvedValue({
      isConnected: true,
    });
    vi.mocked(freighter.getAddress as any).mockResolvedValue({
      address: "G".padEnd(56, "B"),
    });
    await expect(walletProviders.freighter.revalidate()).resolves.toBe(true);
  });
});

describe("wallet/provider — getNetworkSnapshot (#675)", () => {
  beforeEach(() => {
    vi.mocked(freighter.getNetworkDetails as any)?.mockReset?.();
  });

  it("freighter snapshot reports wallet passphrase + name", async () => {
    vi.mocked(freighter.getNetworkDetails as any).mockResolvedValue({
      network: "TESTNET",
      networkUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    const snap = await walletProviders.freighter.getNetworkSnapshot();
    expect(snap).toEqual({
      networkPassphrase: "Test SDF Network ; September 2015",
      networkName: "TESTNET",
    });
  });

  it("freighter snapshot falls back to null when no passphrase is reported", async () => {
    vi.mocked(freighter.getNetworkDetails as any).mockResolvedValue({
      error: { code: -1, message: "no permission" },
    });
    await expect(
      walletProviders.freighter.getNetworkSnapshot(),
    ).resolves.toBeNull();
  });

  it("freighter snapshot returns null when getNetworkDetails throws", async () => {
    vi.mocked(freighter.getNetworkDetails as any).mockRejectedValue(
      new Error("extension unavailable"),
    );
    await expect(
      walletProviders.freighter.getNetworkSnapshot(),
    ).resolves.toBeNull();
  });

  it("albedo snapshot is null (provider does not expose network)", async () => {
    await expect(
      walletProviders.albedo.getNetworkSnapshot(),
    ).resolves.toBeNull();
  });
});

// Sanity-check the registry shape so future refactors don't silently drop
// new methods — keeps the public surface explicit.
describe("wallet/provider — registry invariants", () => {
  const providers: WalletProviderId[] = ["freighter", "albedo"];
  it.each(providers)("%s has all FE-042 + W7-FE-001 methods wired up", (id) => {
    const def = walletProviders[id];
    expect(typeof def.connect).toBe("function");
    expect(typeof def.signTransaction).toBe("function");
    expect(typeof def.revalidate).toBe("function");
    expect(typeof def.getNetworkSnapshot).toBe("function");
  });
});
