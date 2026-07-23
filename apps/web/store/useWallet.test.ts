import { describe, it, expect, beforeEach, vi } from "vitest";

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

import { useWallet } from "@/store/useWallet";
import * as freighter from "@stellar/freighter-api";
import albedo from "@albedo-link/intent";
import { useNetworkStore } from "@/store/useNetworkStore";

const TEST_PASSPHRASE = "Test SDF Network ; September 2015";
const ALBEDO_PUBKEY = "G" + "A".repeat(55);

describe("useWallet — revalidation clears state on stale provider (#651)", () => {
  beforeEach(() => {
    useWallet.getState().disconnect();
    useNetworkStore.setState({ currentNetwork: "testnet" });
    vi.mocked(freighter.isConnected as any)?.mockReset?.();
    vi.mocked(freighter.getAddress as any)?.mockReset?.();
    vi.mocked(albedo.publicKey as any)?.mockReset?.();
    vi.mocked(freighter.getNetworkDetails as any)?.mockReset?.();
  });

  it("flips sessionStatus to stale AND clears address when albedo rejects", async () => {
    // Connect with albedo
    vi.mocked(albedo.publicKey as any).mockResolvedValueOnce({
      pubkey: ALBEDO_PUBKEY,
    } as any);
    vi.mocked(freighter.getNetworkDetails as any).mockResolvedValueOnce({
      network: "TESTNET",
      networkPassphrase: TEST_PASSPHRASE,
    });

    await useWallet.getState().connect("albedo");
    expect(useWallet.getState().isConnected).toBe(true);
    expect(useWallet.getState().address).toBe(ALBEDO_PUBKEY);
    expect(useWallet.getState().walletObservedPassphrase).toBeNull(); // albedo can't report

    // Now revoke: albedo rejects on revalidate
    vi.mocked(albedo.publicKey as any).mockRejectedValueOnce(
      new Error("revoked"),
    );
    const status = await useWallet.getState().revalidateSession();

    expect(status).toBe("stale");
    expect(useWallet.getState().sessionStatus).toBe("stale");
    expect(useWallet.getState().isConnected).toBe(false);
    expect(useWallet.getState().address).toBeNull();
    expect(useWallet.getState().networkAtConnect).toBeNull();
    expect(useWallet.getState().walletObservedPassphrase).toBeNull();
  });
});

describe("useWallet — wallet network snapshot tracking (#675)", () => {
  beforeEach(() => {
    useWallet.getState().disconnect();
    useNetworkStore.setState({ currentNetwork: "testnet" });
    vi.mocked(freighter.isConnected as any)?.mockReset?.();
    vi.mocked(freighter.getAddress as any)?.mockReset?.();
    vi.mocked(albedo.publicKey as any)?.mockReset?.();
    vi.mocked(freighter.getNetworkDetails as any)?.mockReset?.();
  });

  it("records freighter passphrase on connect", async () => {
    vi.mocked(freighter.isConnected as any).mockResolvedValueOnce({
      isConnected: true,
    });
    vi.mocked(freighter.getAddress as any).mockResolvedValueOnce({
      address: "G" + "B".repeat(55),
    });
    vi.mocked(freighter.getNetworkDetails as any).mockResolvedValueOnce({
      network: "TESTNET",
      networkPassphrase: TEST_PASSPHRASE,
    });

    await useWallet.getState().connect("freighter");

    const s = useWallet.getState();
    expect(s.walletObservedPassphrase).toBe(TEST_PASSPHRASE);
    expect(s.walletObservedNetworkName).toBe("TESTNET");
  });

  it("refreshWalletNetworkSnapshot updates passphrase without reconnect", async () => {
    vi.mocked(freighter.isConnected as any).mockResolvedValueOnce({
      isConnected: true,
    });
    vi.mocked(freighter.getAddress as any).mockResolvedValueOnce({
      address: "G" + "C".repeat(55),
    });
    vi.mocked(freighter.getNetworkDetails as any)
      .mockResolvedValueOnce({
        network: "TESTNET",
        networkPassphrase: TEST_PASSPHRASE,
      })
      .mockResolvedValueOnce({
        network: "PUBLIC",
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      });

    await useWallet.getState().connect("freighter");

    await useWallet.getState().refreshWalletNetworkSnapshot();

    expect(useWallet.getState().walletObservedPassphrase).toBe(
      "Public Global Stellar Network ; September 2015",
    );
    expect(useWallet.getState().walletObservedNetworkName).toBe("PUBLIC");
  });

  it("does NOT persist wallet passphrase into storage (re-fetch on hydrate)", async () => {
    vi.mocked(freighter.isConnected as any).mockResolvedValueOnce({
      isConnected: true,
    });
    vi.mocked(freighter.getAddress as any).mockResolvedValueOnce({
      address: "G" + "D".repeat(55),
    });
    vi.mocked(freighter.getNetworkDetails as any).mockResolvedValueOnce({
      network: "TESTNET",
      networkPassphrase: TEST_PASSPHRASE,
    });

    await useWallet.getState().connect("freighter");

    const raw = localStorage.getItem("soroban-wallet-storage");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    // The persisted shape should keep only the public session
    // identifiers — wallet passphrase is intentionally transient.
    const persistedKeys = Object.keys(parsed.state ?? {}).sort();
    expect(persistedKeys).toEqual(
      ["address", "isConnected", "networkAtConnect", "walletType"].sort(),
    );
  });

  it("disconnect clears walletObservedPassphrase", async () => {
    vi.mocked(freighter.isConnected as any).mockResolvedValueOnce({
      isConnected: true,
    });
    vi.mocked(freighter.getAddress as any).mockResolvedValueOnce({
      address: "G" + "E".repeat(55),
    });
    vi.mocked(freighter.getNetworkDetails as any).mockResolvedValueOnce({
      network: "TESTNET",
      networkPassphrase: TEST_PASSPHRASE,
    });

    await useWallet.getState().connect("freighter");
    expect(useWallet.getState().walletObservedPassphrase).toBe(TEST_PASSPHRASE);

    useWallet.getState().disconnect();
    expect(useWallet.getState().walletObservedPassphrase).toBeNull();
    expect(useWallet.getState().walletObservedNetworkName).toBeNull();
  });
});
