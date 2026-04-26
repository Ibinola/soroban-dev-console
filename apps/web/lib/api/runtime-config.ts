/**
 * BE-012 / DEVOPS-005: Frontend client for the /runtime-config API endpoint.
 *
 * Supports runtime profiles (local, demo, production) and feature flags
 * so behavior differences are intentional and maintainable.
 * Falls back to safe defaults if the API is unreachable.
 */

import { DEFAULT_LOCAL_API_URL } from "@devconsole/api-contracts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_LOCAL_API_URL;

export type RuntimeProfile = "local" | "demo" | "production";

export interface RuntimeNetworkEntry {
  id: string;
  name: string;
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl?: string;
}

export interface RuntimeFixtureEntry {
  key: string;
  label: string;
  description: string;
  network: string;
  contractId: string | null;
}

export interface RuntimeFeatureFlags {
  enableSharing: boolean;
  enableMultiOp: boolean;
  enableTokenDashboard: boolean;
  enableAuditLog: boolean;
  enableRpcGateway: boolean;
}

export interface RuntimeConfig {
  version: number;
  profile: RuntimeProfile;
  networks: RuntimeNetworkEntry[];
  fixtures: RuntimeFixtureEntry[];
  flags: RuntimeFeatureFlags;
}

export type RuntimeConfigState = "loading" | "live" | "fallback" | "error";

export interface RuntimeConfigWithState {
  config: RuntimeConfig;
  state: RuntimeConfigState;
  lastFetch?: Date;
  errorMessage?: string;
}

const FALLBACK_CONFIG: RuntimeConfig = {
  version: 1,
  profile: "local",
  networks: [
    {
      id: "testnet",
      name: "Testnet",
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
      horizonUrl: "https://horizon-testnet.stellar.org",
    },
  ],
  fixtures: [],
  flags: {
    enableSharing: true,
    enableMultiOp: true,
    enableTokenDashboard: true,
    enableAuditLog: true,
    enableRpcGateway: true,
  },
};

let cached: RuntimeConfigWithState | null = null;
let isLoading = false;

export async function fetchRuntimeConfig(): Promise<RuntimeConfigWithState> {
  if (cached) return cached;
  
  if (isLoading) {
    // Return loading state if already fetching
    return {
      config: FALLBACK_CONFIG,
      state: "loading",
    };
  }

  isLoading = true;

  try {
    const res = await fetch(`${API_BASE}/runtime-config`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const config = (await res.json()) as RuntimeConfig;
    cached = {
      config,
      state: "live",
      lastFetch: new Date(),
    };
    return cached;
  } catch (error) {
    console.warn("[runtime-config] Failed to fetch from API — using fallback config", error);
    cached = {
      config: FALLBACK_CONFIG,
      state: "fallback",
      lastFetch: new Date(),
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    };
    return cached;
  } finally {
    isLoading = false;
  }
}

/** Reset the in-memory cache (useful for testing). */
export function resetRuntimeConfigCache(): void {
  cached = null;
  isLoading = false;
}

/** Returns true when the given flag is enabled in the cached config. */
export function isFeatureEnabled(flag: keyof RuntimeFeatureFlags): boolean {
  return cached?.config.flags[flag] ?? FALLBACK_CONFIG.flags[flag];
}

/** Get the current runtime config state */
export function getRuntimeConfigState(): RuntimeConfigWithState | null {
  return cached;
}

/** Force refresh the runtime config */
export async function refreshRuntimeConfig(): Promise<RuntimeConfigWithState> {
  resetRuntimeConfigCache();
  return fetchRuntimeConfig();
}
