export interface NetworkProfile {
  id: string;
  name: string;
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl?: string;
  builtIn?: boolean;
}

export const BUILT_IN_NETWORK_PROFILES: NetworkProfile[] = [
  {
    id: "mainnet",
    name: "Mainnet",
    rpcUrl: "https://soroban-rpc.mainnet.stellar.org",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    horizonUrl: "https://horizon.stellar.org",
    builtIn: true,
  },
  {
    id: "testnet",
    name: "Testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    horizonUrl: "https://horizon-testnet.stellar.org",
    builtIn: true,
  },
  {
    id: "futurenet",
    name: "Futurenet",
    rpcUrl: "https://rpc-futurenet.stellar.org",
    networkPassphrase: "Test SDF Future Network ; October 2022",
    horizonUrl: "https://horizon-futurenet.stellar.org",
    builtIn: true,
  },
  {
    id: "local",
    name: "Local Standalone",
    rpcUrl: "http://localhost:8000/soroban/rpc",
    networkPassphrase: "Standalone Network ; February 2017",
    horizonUrl: "http://localhost:8000",
    builtIn: true,
  },
];

export function createDefaultNetworkProfiles(): NetworkProfile[] {
  return BUILT_IN_NETWORK_PROFILES.map((p) => ({ ...p }));
}

export function createNetworkProfile(input: {
  name: string;
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl?: string;
  id?: string;
}): NetworkProfile {
  return {
    id:
      input.id ??
      `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim(),
    rpcUrl: input.rpcUrl.trim(),
    networkPassphrase: input.networkPassphrase,
    horizonUrl: input.horizonUrl?.trim() || undefined,
  };
}

export function duplicateNetworkProfile(
  source: NetworkProfile,
  name?: string,
): NetworkProfile {
  return {
    ...source,
    id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: (name ?? `${source.name} Copy`).trim(),
    builtIn: false,
  };
}
