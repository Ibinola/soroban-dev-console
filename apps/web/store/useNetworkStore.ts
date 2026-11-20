import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  BUILT_IN_NETWORK_PROFILES,
  createDefaultNetworkProfiles,
  createNetworkProfile,
  duplicateNetworkProfile,
  type NetworkProfile,
} from "@/lib/network-config";

export interface NetworkHealth {
  status: "healthy" | "degraded" | "offline";
  latestLedger: number;
  protocolVersion: number;
  latencyMs: number;
  lastCheck: number;
}

export interface NetworkConfig {
  id: string;
  name: string;
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl?: string;
  isCustom?: boolean;
  funding?: FundingProviderConfig;
}

export interface FundingProviderConfig {
  type: "none" | "friendbot" | "custom-http";
  label?: string;
  endpoint?: string;
}

// Default/System Networks (Read-only) - kept for backward compatibility
export const DEFAULT_NETWORKS: Record<string, NetworkConfig> = {
  mainnet: {
    id: "mainnet",
    name: "Mainnet",
    rpcUrl: "https://soroban-rpc.mainnet.stellar.org",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    horizonUrl: "https://horizon.stellar.org",
  },
  testnet: {
    id: "testnet",
    name: "Testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    horizonUrl: "https://horizon-testnet.stellar.org",
    funding: {
      type: "friendbot",
      label: "Get Testnet XLM",
      endpoint: "https://friendbot.stellar.org",
    },
  },
  futurenet: {
    id: "futurenet",
    name: "Futurenet",
    rpcUrl: "https://rpc-futurenet.stellar.org",
    networkPassphrase: "Test SDF Future Network ; October 2022",
    horizonUrl: "https://horizon-futurenet.stellar.org",
    funding: { type: "none" },
  },
  local: {
    id: "local",
    name: "Local Standalone",
    rpcUrl: "http://localhost:8000/soroban/rpc",
    networkPassphrase: "Standalone Network ; February 2017",
    horizonUrl: "http://localhost:8000",
    funding: { type: "none" },
  },
};

const BUILT_IN_IDS = new Set(BUILT_IN_NETWORK_PROFILES.map((p) => p.id));

function toNetworkConfig(profile: NetworkProfile): NetworkConfig {
  const base = DEFAULT_NETWORKS[profile.id];
  return {
    id: profile.id,
    name: profile.name,
    rpcUrl: profile.rpcUrl,
    networkPassphrase: profile.networkPassphrase,
    horizonUrl: profile.horizonUrl ?? base?.horizonUrl,
    isCustom: !BUILT_IN_IDS.has(profile.id) || profile.builtIn === false,
    funding: base?.funding,
  };
}

function normalizeProfiles(input: unknown, fallback: NetworkProfile[]): NetworkProfile[] {
  if (!Array.isArray(input) || input.length === 0) return fallback;
  const profiles = input
    .filter((p): p is NetworkProfile => !!p && typeof p === "object")
    .map((p: any) => ({
      id: String(p.id ?? "").trim(),
      name: String(p.name ?? "").trim() || "Unnamed Profile",
      rpcUrl: String(p.rpcUrl ?? "").trim(),
      networkPassphrase: String(p.networkPassphrase ?? ""),
      horizonUrl: p.horizonUrl ? String(p.horizonUrl) : undefined,
      builtIn: !!p.builtIn,
    }))
    .filter((p) => p.id && p.rpcUrl);
  return profiles.length > 0 ? profiles : fallback;
}

interface NetworkState {
  profiles: NetworkProfile[];
  activeProfileId: string;
  // legacy aliases
  currentNetwork: string;
  customNetworks: NetworkConfig[];
  health: NetworkHealth | null;
  autoFailover: boolean;
  degradationThresholdMs: number;
  failoverNetworkId: string;
  bypassCorsProxy: boolean;

  setNetwork: (id: string) => void;
  setActiveProfile: (id: string) => void;
  setHealth: (health: NetworkHealth | null) => void;
  addCustomNetwork: (network: NetworkConfig) => void;
  addProfile: (profile: Omit<NetworkProfile, "id"> & { id?: string }) => string;
  updateProfile: (id: string, updates: Partial<Omit<NetworkProfile, "id">>) => void;
  duplicateProfile: (id: string) => string | null;
  removeProfile: (id: string) => void;
  removeCustomNetwork: (id: string) => void;
  setAutoFailover: (enabled: boolean) => void;
  setDegradationThreshold: (ms: number) => void;
  setFailoverNetworkId: (id: string) => void;
  setBypassCorsProxy: (bypass: boolean) => void;

  // Helpers
  getActiveNetworkConfig: () => NetworkConfig;
  getActiveProfile: () => NetworkProfile;
  getAllNetworks: () => NetworkConfig[];
  getHorizonUrl: () => string;
  getFundingProvider: () => FundingProviderConfig;
  isNetworkMismatch: (recordedNetworkId: string | null) => boolean;
}

function ensureActive(profiles: NetworkProfile[], activeId: string): string {
  if (profiles.some((p) => p.id === activeId)) return activeId;
  return profiles.find((p) => p.id === "testnet")?.id ?? profiles[0]?.id ?? "testnet";
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set, get) => {
      const initialProfiles = createDefaultNetworkProfiles();
      return {
        profiles: initialProfiles,
        activeProfileId: "testnet",
        currentNetwork: "testnet",
        customNetworks: [],
        bypassCorsProxy: false,
        health: null,
        autoFailover: false,
        degradationThresholdMs: 2000,
        failoverNetworkId: "mainnet",

        setNetwork: (id) => {
          const next = ensureActive(get().profiles, id);
          set({ activeProfileId: next, currentNetwork: next, health: null });
        },
        setActiveProfile: (id) => get().setNetwork(id),
        setHealth: (health) => set({ health }),
        setAutoFailover: (enabled) => set({ autoFailover: enabled }),
        setDegradationThreshold: (ms) => set({ degradationThresholdMs: ms }),
        setFailoverNetworkId: (id) => set({ failoverNetworkId: id }),
        setBypassCorsProxy: (bypass) => set({ bypassCorsProxy: bypass }),

        addProfile: (profile) => {
          const created = createNetworkProfile({
            id: profile.id,
            name: profile.name,
            rpcUrl: profile.rpcUrl,
            networkPassphrase: profile.networkPassphrase,
            horizonUrl: profile.horizonUrl,
          });
          set((state) => {
            const profiles = [...state.profiles, created];
            return {
              profiles,
              customNetworks: profiles.filter((p) => !BUILT_IN_IDS.has(p.id)).map(toNetworkConfig),
            };
          });
          return created.id;
        },

        addCustomNetwork: (network) => {
          get().addProfile({
            id: network.id,
            name: network.name,
            rpcUrl: network.rpcUrl,
            networkPassphrase: network.networkPassphrase,
            horizonUrl: network.horizonUrl,
          });
        },

        updateProfile: (id, updates) =>
          set((state) => {
            const profiles = state.profiles.map((p) =>
              p.id === id
                ? {
                    ...p,
                    ...updates,
                    name: (updates.name ?? p.name).trim() || p.name,
                    rpcUrl: (updates.rpcUrl ?? p.rpcUrl).trim() || p.rpcUrl,
                    networkPassphrase:
                      updates.networkPassphrase ?? p.networkPassphrase,
                    horizonUrl:
                      updates.horizonUrl !== undefined
                        ? updates.horizonUrl?.trim() || undefined
                        : p.horizonUrl,
                  }
                : p,
            );
            return {
              profiles,
              customNetworks: profiles.filter((p) => !BUILT_IN_IDS.has(p.id)).map(toNetworkConfig),
            };
          }),

        duplicateProfile: (id) => {
          const source = get().profiles.find((p) => p.id === id);
          if (!source) return null;
          const copy = duplicateNetworkProfile(source);
          set((state) => {
            const profiles = [...state.profiles, copy];
            return {
              profiles,
              customNetworks: profiles.filter((p) => !BUILT_IN_IDS.has(p.id)).map(toNetworkConfig),
            };
          });
          return copy.id;
        },

        removeProfile: (id) =>
          set((state) => {
            if (state.profiles.length <= 1) return state;
            const profiles = state.profiles.filter((p) => p.id !== id);
            if (profiles.length === state.profiles.length) return state;
            const activeProfileId = ensureActive(profiles, state.activeProfileId === id ? "testnet" : state.activeProfileId);
            return {
              profiles,
              activeProfileId,
              currentNetwork: activeProfileId,
              health: state.activeProfileId === id ? null : state.health,
              customNetworks: profiles.filter((p) => !BUILT_IN_IDS.has(p.id)).map(toNetworkConfig),
            };
          }),

        removeCustomNetwork: (id) => get().removeProfile(id),

        getActiveProfile: () => {
          const state = get();
          return (
            state.profiles.find((p) => p.id === state.activeProfileId) ||
            state.profiles.find((p) => p.id === "testnet") ||
            state.profiles[0] ||
            createDefaultNetworkProfiles()[1]
          );
        },

        getActiveNetworkConfig: () => toNetworkConfig(get().getActiveProfile()),

        getAllNetworks: () => get().profiles.map(toNetworkConfig),

        getHorizonUrl: () => {
          const network = get().getActiveNetworkConfig();
          return network.horizonUrl ?? DEFAULT_NETWORKS["testnet"].horizonUrl!;
        },

        getFundingProvider: () => {
          const network = get().getActiveNetworkConfig();
          return network.funding ?? { type: "none" };
        },

        isNetworkMismatch: (recordedNetworkId) => {
          if (!recordedNetworkId) return false;
          return get().activeProfileId !== recordedNetworkId;
        },
      };
    },
    {
      name: "soroban-network-storage",
      version: 2,
      partialize: (state) => ({
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
        // legacy fields for older readers/safety
        currentNetwork: state.activeProfileId,
        customNetworks: state.profiles
          .filter((p) => !BUILT_IN_IDS.has(p.id))
          .map(toNetworkConfig),
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as any;
        let profiles: NetworkProfile[] | null = null;
        let activeProfileId: string | undefined;

        if (Array.isArray(persisted.profiles)) {
          profiles = normalizeProfiles(persisted.profiles, createDefaultNetworkProfiles());
          activeProfileId = persisted.activeProfileId || persisted.currentNetwork;
        } else if (persisted.currentNetwork || Array.isArray(persisted.customNetworks)) {
          // migrate v1 shape
          const base = createDefaultNetworkProfiles();
          const customs = Array.isArray(persisted.customNetworks) ? persisted.customNetworks : [];
          const customProfiles: NetworkProfile[] = customs
            .filter((n: any) => n && n.id && n.rpcUrl)
            .map((n: any) => ({
              id: String(n.id),
              name: String(n.name || n.id),
              rpcUrl: String(n.rpcUrl),
              networkPassphrase: String(n.networkPassphrase || ""),
              horizonUrl: n.horizonUrl ? String(n.horizonUrl) : undefined,
              builtIn: false,
            }));
          profiles = [...base, ...customProfiles.filter((cp) => !base.some((b) => b.id === cp.id))];
          activeProfileId = persisted.currentNetwork;
        }

        const resolvedProfiles = profiles ?? currentState.profiles;
        const resolvedActive = ensureActive(resolvedProfiles, String(activeProfileId || currentState.activeProfileId));
        return {
          ...currentState,
          ...persisted,
          profiles: resolvedProfiles,
          activeProfileId: resolvedActive,
          currentNetwork: resolvedActive,
          customNetworks: resolvedProfiles
            .filter((p) => !BUILT_IN_IDS.has(p.id))
            .map(toNetworkConfig),
        } as NetworkState;
      },
    },
  ),
);
