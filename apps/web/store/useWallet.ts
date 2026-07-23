import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  walletProviders,
  assertCapability,
  type WalletCapabilities,
  type WalletProviderId,
  type WalletNetworkSnapshot,
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
  // W7-FE-001: passphrase the wallet reports as its currently selected
  // network. Used to render the mismatch banner. Null when the provider
  // (e.g. Albedo) cannot tell us its network — in that case we suppress
  // the banner rather than risking a false positive.
  walletObservedPassphrase: string | null;
  walletObservedNetworkName: string | null;
  // FE-043: sandbox mode
  isSandboxMode: boolean;

  connect: (provider: WalletProviderId) => Promise<void>;
  disconnect: () => void;
  // FE-041: capability-aware sign abstraction
  signTransaction: (xdr: string, networkPassphrase: string) => Promise<string>;
  getCapabilities: () => WalletCapabilities | null;
  // FE-042: revalidation
  revalidateSession: () => Promise<SessionStatus>;
  // W7-FE-001: refresh the wallet's currently selected network snapshot
  refreshWalletNetworkSnapshot: () => Promise<void>;
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
      walletObservedPassphrase: null,
      walletObservedNetworkName: null,
      isSandboxMode: false,

      connect: async (provider) => {
        try {
          const session = await walletProviders[provider].connect();
          const currentNetwork = useNetworkStore.getState().currentNetwork;
          // W7-FE-001: best-effort snapshot of the wallet's selected network.
          // If the provider cannot report it (e.g. Albedo), the value stays
          // null and the mismatch UI is suppressed.
          let snapshot: WalletNetworkSnapshot | null = null;
          try {
            snapshot = await walletProviders[provider].getNetworkSnapshot();
          } catch {
            snapshot = null;
          }
          set({
            isConnected: true,
            address: session.address,
            walletType: session.provider,
            sessionStatus: "valid",
            networkAtConnect: currentNetwork,
            walletObservedPassphrase: snapshot?.networkPassphrase ?? null,
            walletObservedNetworkName: snapshot?.networkName ?? null,
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
          walletObservedPassphrase: null,
          walletObservedNetworkName: null,
          isSandboxMode: false,
        });
      },

      // FE-041: unified signing abstraction with capability guard
      signTransaction: async (xdr, networkPassphrase) => {
        const { walletType, isConnected } = get();
        if (!isConnected || !walletType) {
          throw new Error("No wallet connected.");
        }
        assertCapability(walletType, "canSign");
        return walletProviders[walletType].signTransaction(
          xdr,
          networkPassphrase,
        );
      },

      // FE-041: expose capability metadata
      getCapabilities: () => {
        const { walletType } = get();
        if (!walletType) return null;
        return walletProviders[walletType].capabilities;
      },

      // FE-042: revalidate persisted session against live provider state
      revalidateSession: async () => {
        const { walletType, isConnected, networkAtConnect } = get();

        if (!isConnected || !walletType) {
          set({ sessionStatus: "disconnected" });
          return "disconnected";
        }

        const stillLive = await walletProviders[walletType].revalidate();
        if (!stillLive) {
          // W7-FE-002 (#651): when the provider session has expired we must
          // also clear the wallet store, otherwise the UI will continue to
          // show the user as "connected" with a stale address.
          set({
            sessionStatus: "stale",
            isConnected: false,
            address: null,
            networkAtConnect: null,
            walletObservedPassphrase: null,
            walletObservedNetworkName: null,
          });
          return "stale";
        }

        // FE-042: detect network mismatch
        const currentNetwork = useNetworkStore.getState().currentNetwork;
        if (networkAtConnect && networkAtConnect !== currentNetwork) {
          set({ sessionStatus: "mismatch" });
          return "mismatch";
        }

        set({ sessionStatus: "valid" });
        return "valid";
      },

      // W7-FE-001: re-fetch the wallet's currently selected network. Called
      // after every app-level network switch so the mismatch banner reflects
      // the latest state without requiring a wallet reconnect.
      refreshWalletNetworkSnapshot: async () => {
        const { walletType, isConnected } = get();
        if (!isConnected || !walletType) {
          return;
        }
        let snapshot: WalletNetworkSnapshot | null = null;
        try {
          snapshot = await walletProviders[walletType].getNetworkSnapshot();
        } catch {
          snapshot = null;
        }
        set({
          walletObservedPassphrase: snapshot?.networkPassphrase ?? null,
          walletObservedNetworkName: snapshot?.networkName ?? null,
        });
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
      // FE-042: don't persist transient session status; W7-FE-001 also keeps
      // the wallet-observed network out of the cache because it must be
      // re-fetched from the live provider on each session restore.
      partialize: (state) => ({
        isConnected: state.isConnected,
        address: state.address,
        walletType: state.walletType,
        networkAtConnect: state.networkAtConnect,
      }),
    },
  ),
);
