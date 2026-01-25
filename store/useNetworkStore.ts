import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NetworkConfig {
  id: string; // Changed from strict literal to string to allow custom IDs
  name: string;
  rpcUrl: string;
  networkPassphrase: string;
  isCustom?: boolean;
}

// Default/System Networks (Read-only)
export const DEFAULT_NETWORKS: Record<string, NetworkConfig> = {
  mainnet: {
    id: "mainnet",
    name: "Mainnet",
    rpcUrl: "https://soroban-rpc.mainnet.stellar.org",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
  },
  testnet: {
    id: "testnet",
    name: "Testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  futurenet: {
    id: "futurenet",
    name: "Futurenet",
    rpcUrl: "https://rpc-futurenet.stellar.org",
    networkPassphrase: "Test SDF Future Network ; October 2022",
  },
  local: {
    id: "local",
    name: "Local Standalone",
    rpcUrl: "http://localhost:8000/soroban/rpc",
    networkPassphrase: "Standalone Network ; February 2017",
  },
};

interface NetworkState {
  currentNetwork: string;
  customNetworks: NetworkConfig[];

  setNetwork: (id: string) => void;
  addCustomNetwork: (network: NetworkConfig) => void;
  removeCustomNetwork: (id: string) => void;

  // Helpers
  getActiveNetworkConfig: () => NetworkConfig;
  getAllNetworks: () => NetworkConfig[];
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set, get) => ({
      currentNetwork: "testnet",
      customNetworks: [],

      setNetwork: (id) => set({ currentNetwork: id }),

      addCustomNetwork: (network) =>
        set((state) => ({
          customNetworks: [
            ...state.customNetworks,
            { ...network, isCustom: true },
          ],
        })),

      removeCustomNetwork: (id) =>
        set((state) => {
          // If deleting the active network, switch back to Testnet safely
          const nextNetwork =
            state.currentNetwork === id ? "testnet" : state.currentNetwork;
          return {
            customNetworks: state.customNetworks.filter((n) => n.id !== id),
            currentNetwork: nextNetwork,
          };
        }),

      getActiveNetworkConfig: () => {
        const state = get();
        const all = { ...DEFAULT_NETWORKS };
        state.customNetworks.forEach((n) => (all[n.id] = n));
        return all[state.currentNetwork] || DEFAULT_NETWORKS["testnet"];
      },

      getAllNetworks: () => {
        const state = get();
        return [...Object.values(DEFAULT_NETWORKS), ...state.customNetworks];
      },
    }),
    {
      name: "soroban-network-storage",
      // Only persist these fields
      partialize: (state) => ({
        currentNetwork: state.currentNetwork,
        customNetworks: state.customNetworks,
      }),
    },
  ),
);