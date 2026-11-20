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
        disconnect: vi.fn(),
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
        disconnect: vi.fn(),
      },
      xbull: {
        id: "xbull",
        label: "xBull",
        description: "",
        accentClassName: "",
        capabilities: {
          canSign: true,
          canSignAuthEntries: false,
          requiresExtension: true,
          supportsTestnet: true,
          supportsMainnet: true,
        },
        connect: vi.fn(),
        signTransaction: vi.fn(),
        revalidate: vi.fn(),
        disconnect: vi.fn(),
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

const { mockGetState } = vi.hoisted(() => ({
  mockGetState: vi.fn(() => ({
    resetSyncState: vi.fn(),
  })),
}));

vi.mock("@/store/useWorkspaceStore", () => {
  return {
    useWorkspaceStore: {
      getState: mockGetState,
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

  it("calls provider disconnect and resets state when disconnectWallet is invoked", async () => {
    useWallet.setState({
      isConnected: true,
      address: "GAAAA",
      walletType: "freighter",
      sessionStatus: "valid",
      networkAtConnect: "testnet",
      networkPassphraseAtConnect: null,
      isSandboxMode: false,
    });
    (walletProviders.freighter.disconnect as any).mockResolvedValueOnce(undefined);

    await useWallet.getState().disconnectWallet();

    expect(walletProviders.freighter.disconnect).toHaveBeenCalled();
    expect(useWallet.getState().isConnected).toBe(false);
    expect(useWallet.getState().address).toBeNull();
    expect(useWallet.getState().walletType).toBeNull();
    expect(useWallet.getState().sessionStatus).toBe("disconnected");
  });

  it("resets workspace sync state on disconnect", async () => {
    useWallet.setState({
      isConnected: true,
      address: "GAAAA",
      walletType: "albedo",
      sessionStatus: "valid",
      networkAtConnect: "testnet",
      networkPassphraseAtConnect: null,
    });
    (walletProviders.albedo.disconnect as any).mockResolvedValueOnce(undefined);
    const { useWorkspaceStore } = await import("@/store/useWorkspaceStore");
    const resetSyncState = vi.fn();
    (useWorkspaceStore.getState as any).mockReturnValue({
      resetSyncState,
    });

    await useWallet.getState().disconnectWallet();

    expect(walletProviders.albedo.disconnect).toHaveBeenCalled();
    expect(resetSyncState).toHaveBeenCalled();
  });

  it("handles provider disconnect failure gracefully", async () => {
    useWallet.setState({
      isConnected: true,
      address: "GAAAA",
      walletType: "xbull",
      sessionStatus: "valid",
      networkAtConnect: "testnet",
      networkPassphraseAtConnect: null,
    });
    (walletProviders.xbull.disconnect as any).mockRejectedValueOnce(
      new Error("disconnect failed"),
    );

    await expect(useWallet.getState().disconnectWallet()).resolves.toBeUndefined();

    expect(useWallet.getState().isConnected).toBe(false);
    expect(useWallet.getState().walletType).toBeNull();
  });

  it("purges the session cookie and rotates the session token on disconnect (#949)", async () => {
    document.cookie = "sdc_session_id=pre-auth-fixation-token; Path=/";

    useWallet.setState({
      isConnected: true,
      address: "GAAAA",
      walletType: "freighter",
      sessionStatus: "valid",
      networkAtConnect: "testnet",
      networkPassphraseAtConnect: null,
      sessionToken: "pre-auth-fixation-token",
    });
    (walletProviders.freighter.disconnect as any).mockResolvedValueOnce(undefined);

    await useWallet.getState().disconnectWallet();

    const cookieMatch = document.cookie
      .split("; ")
      .find((row) => row.startsWith("sdc_session_id="));
    const newToken = useWallet.getState().sessionToken;

    expect(newToken).not.toBeNull();
    expect(newToken).not.toBe("pre-auth-fixation-token");
    // The rotated token is the only value the cookie may now carry.
    expect(cookieMatch).toBe(`sdc_session_id=${newToken}`);
  });
});
