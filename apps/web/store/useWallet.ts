import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  walletProviders,
  assertCapability,
  type WalletCapabilities,
  type WalletProviderId,
} from "@/lib/wallet/provider";
import { useNetworkStore } from "@/store/useNetworkStore";

// FE-042: Session revalidation state
export type SessionStatus = "valid" | "stale" | "mismatch" | "disconnected";

interface WalletState {
  isConnected: boolean;
  address: string | null;
  walletType: WalletProviderId | null;
  // FE-042: track session health
  sessionStatus: SessionStatus;
  networkAtConnect: string | null;
  // FE-043: sandbox mode
  isSandboxMode: boolean;
  // W7-FE-002 / #675: network passphrase captured at connect time so we
  // can detect a wallet-vs-app network mismatch after re-hydration.
  networkPassphraseAtConnect: string | null;

  connect: (provider: WalletProviderId) => Promise<void>;
  disconnect: () => void;
  // FE-041: capability-aware sign abstraction
  signTransaction: (xdr: string, networkPassphrase: string) => Promise<string>;
  getCapabilities: () => WalletCapabilities | null;
  // FE-042: revalidation
  revalidateSession: () => Promise<SessionStatus>;
  // FE-043: sandbox helpers
  enterSandbox: () => void;
  exitSandbox: () => void;
}

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      isConnected: false,
      address: null,
      walletType: null,
      sessionStatus: "disconnected",
      networkAtConnect: null,
      isSandboxMode: false,
      networkPassphraseAtConnect: null,

      connect: async (provider) => {
        try {
          const session = await walletProviders[provider].connect();
          const currentNetwork = useNetworkStore.getState().currentNetwork;
          set({
            isConnected: true,
            address: session.address,
            walletType: session.provider,
            sessionStatus: "valid",
            networkAtConnect: currentNetwork,
            networkPassphraseAtConnect: session.networkPassphrase ?? null,
            isSandboxMode: false,
          });
        } catch (e: any) {
          console.error(`${provider} connection failed`, e);
          throw e;
        }
      },

      disconnect: () => {
        set({
          isConnected: false,
          address: null,
          walletType: null,
          sessionStatus: "disconnected",
          networkAtConnect: null,
          isSandboxMode: false,
          networkPassphraseAtConnect: null,
        });
      },

      // FE-041: unified signing abstraction with capability guard
      signTransaction: async (xdr, networkPassphrase) => {
        const { walletType, isConnected } = get();
        if (!isConnected || !walletType) {
          throw new Error("No wallet connected.");
        }
        assertCapability(walletType, "canSign");
        return walletProviders[walletType].signTransaction(xdr, networkPassphrase);
      },

      // FE-041: expose capability metadata
      getCapabilities: () => {
        const { walletType } = get();
        if (!walletType) return null;
        return walletProviders[walletType].capabilities;
      },

      // FE-042: revalidate persisted session against live provider state.
      // If the wallet reports the session is no longer valid we fully
      // disconnect so the user is forced back to the connect prompt.
      revalidateSession: async () => {
        const { walletType, isConnected, networkAtConnect, networkPassphraseAtConnect } = get();

        if (!isConnected || !walletType) {
          set({ sessionStatus: "disconnected" });
          return "disconnected";
        }

        let revalidateResult;
        try {
          revalidateResult = await walletProviders[walletType].revalidate();
        } catch (err) {
          // Treat any thrown error as a stale session — the wallet store
          // should clear and prompt the user to reconnect.
          revalidateResult = { isValid: false };
        }

        if (!revalidateResult?.isValid) {
          // W7-FE-002 / #651: failed revalidation clears the wallet store
          // and surfaces the connect prompt.
          get().disconnect();
          return "disconnected";
        }

        // W7-FE-002 / #675: detect network mismatch using the wallet's
        // freshly-fetched passphrase. Fall back to the network ID for
        // legacy persisted sessions that lack a passphrase.
        const currentNetwork = useNetworkStore.getState().currentNetwork;
        const currentPassphrase = useNetworkStore
          .getState()
          .getActiveNetworkConfig().networkPassphrase;

        const walletPassphrase =
          revalidateResult.networkPassphrase ??
          networkPassphraseAtConnect ??
          null;

        if (walletPassphrase && walletPassphrase !== currentPassphrase) {
          set({ sessionStatus: "mismatch" });
          return "mismatch";
        }

        if (networkAtConnect && networkAtConnect !== currentNetwork) {
          set({ sessionStatus: "mismatch" });
          return "mismatch";
        }

        set({ sessionStatus: "valid" });
        return "valid";
      },

      // FE-043: enter wallet-less sandbox mode
      enterSandbox: () => {
        set({ isSandboxMode: true });
      },

      // FE-043: exit sandbox, preserving any in-progress state
      exitSandbox: () => {
        set({ isSandboxMode: false });
      },
    }),
    {
      name: "soroban-wallet-storage",
      version: 1,
      // FE-042: don't persist transient session status
      partialize: (state) => ({
        isConnected: state.isConnected,
        address: state.address,
        walletType: state.walletType,
        networkAtConnect: state.networkAtConnect,
        networkPassphraseAtConnect: state.networkPassphraseAtConnect,
      }),
    },
  ),
);
