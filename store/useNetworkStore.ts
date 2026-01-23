// store/useNetworkStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NetworkId = 'mainnet' | 'testnet' | 'futurenet' | 'local';

interface NetworkConfig {
  id: NetworkId;
  name: string;
  rpcUrl: string;
  networkPassphrase: string;
}

// Configuration Constants
export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  mainnet: {
    id: 'mainnet',
    name: 'Mainnet',
    rpcUrl: 'https://soroban-rpc.mainnet.stellar.org',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
  },
  testnet: {
    id: 'testnet',
    name: 'Testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
  },
  futurenet: {
    id: 'futurenet',
    name: 'Futurenet',
    rpcUrl: 'https://rpc-futurenet.stellar.org',
    networkPassphrase: 'Test SDF Future Network ; October 2022',
  },
  local: {
    id: 'local',
    name: 'Local Standalone',
    rpcUrl: 'http://localhost:8000/soroban/rpc',
    networkPassphrase: 'Standalone Network ; February 2017',
  },
};

interface NetworkState {
  currentNetwork: NetworkId;
  setNetwork: (id: NetworkId) => void;
  // Helper to get the full config object
  getActiveNetworkConfig: () => NetworkConfig;
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set, get) => ({
      currentNetwork: 'testnet', // Default to Testnet for safety
      setNetwork: (id) => set({ currentNetwork: id }),
      getActiveNetworkConfig: () => NETWORKS[get().currentNetwork],
    }),
    {
      name: 'soroban-network-storage',
    }
  )
);