import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/wallet/provider", () => {
  return {
    walletProviders: {
      freighter: {
        id: "freighter",
        label: "Freighter",
        description: "",
        accentClassName: "",
        capabilities: {
          canSign: true,
          canSignAuthEntries: true,
          requiresExtension: true,
          supportsTestnet: true,
          supportsMainnet: true,
        },
        connect: vi.fn(),
        signTransaction: vi.fn(),
        revalidate: vi.fn(),
      },
      albedo: {
        id: "albedo",
        label: "Albedo",
        description: "",
        accentClassName: "",
        capabilities: {
          canSign: true,
          canSignAuthEntries: false,
          requiresExtension: false,
          supportsTestnet: true,
          supportsMainnet: true,
        },
        connect: vi.fn(),
        signTransaction: vi.fn(),
        revalidate: vi.fn(),
      },
    },
    assertCapability: vi.fn(),
  };
});

vi.mock("@/store/useNetworkStore", () => {
  return {
    useNetworkStore: {
      getState: () => ({
        currentNetwork: "testnet",
        getActiveNetworkConfig: () => ({
          id: "testnet",
          name: "Testnet",
          rpcUrl: "http://x",
          networkPassphrase: "Test SDF Network ; September 2015",
        }),
      }),
    },
  };
});

import { useWallet } from "./useWallet";
import { walletProviders } from "@/lib/wallet/provider";

describe("useWallet — session revalidation (W7-FE-002 / #651)", () => {
  beforeEach(() => {
    useWallet.setState({
      isConnected: false,
      address: null,
      walletType: null,
      sessionStatus: "disconnected",
      networkAtConnect: null,
      networkPassphraseAtConnect: null,
      isSandboxMode: false,
    });
    vi.clearAllMocks();
  });

  it("clears the wallet store when albedo revalidation rejects", async () => {
    // Arrange — wallet store is "connected" via albedo.
    useWallet.setState({
      isConnected: true,
      address: "GAAAA",
      walletType: "albedo",
      sessionStatus: "valid",
      networkAtConnect: "testnet",
      networkPassphraseAtConnect: null,
    });
    (walletProviders.albedo.revalidate as any).mockResolvedValueOnce({
      isValid: false,
    });

    // Act — revalidate the session.
    const status = await useWallet.getState().revalidateSession();

    // Assert — store cleared, status returns disconnected.
    const next = useWallet.getState();
    expect(status).toBe("disconnected");
    expect(next.isConnected).toBe(false);
    expect(next.address).toBeNull();
    expect(next.walletType).toBeNull();
    expect(next.sessionStatus).toBe("disconnected");
  });

  it("treats a thrown revalidate as a stale session", async () => {
    useWallet.setState({
      isConnected: true,
      address: "GAAAA",
      walletType: "albedo",
      sessionStatus: "valid",
      networkAtConnect: "testnet",
      networkPassphraseAtConnect: null,
    });
    (walletProviders.albedo.revalidate as any).mockRejectedValueOnce(
      new Error("rejected"),
    );

    const status = await useWallet.getState().revalidateSession();

    expect(status).toBe("disconnected");
    expect(useWallet.getState().isConnected).toBe(false);
    expect(useWallet.getState().sessionStatus).toBe("disconnected");
  });

  it("flags a network mismatch when the wallet passphrase differs", async () => {
    useWallet.setState({
      isConnected: true,
      address: "GAAAA",
      walletType: "freighter",
      sessionStatus: "valid",
      networkAtConnect: "testnet",
      networkPassphraseAtConnect: "Test SDF Network ; September 2015",
    });
    (walletProviders.freighter.revalidate as any).mockResolvedValueOnce({
      isValid: true,
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });

    const status = await useWallet.getState().revalidateSession();

    expect(status).toBe("mismatch");
    expect(useWallet.getState().sessionStatus).toBe("mismatch");
  });

  it("keeps the session valid when the passphrase matches", async () => {
    useWallet.setState({
      isConnected: true,
      address: "GAAAA",
      walletType: "freighter",
      sessionStatus: "valid",
      networkAtConnect: "testnet",
      networkPassphraseAtConnect: "Test SDF Network ; September 2015",
    });
    (walletProviders.freighter.revalidate as any).mockResolvedValueOnce({
      isValid: true,
      networkPassphrase: "Test SDF Network ; September 2015",
    });

    const status = await useWallet.getState().revalidateSession();

    expect(status).toBe("valid");
    expect(useWallet.getState().sessionStatus).toBe("valid");
  });
});
