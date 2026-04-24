import { NetworkConfig, NetworkHealth } from "../store/useNetworkStore";

export type NetworkStatus = "valid" | "invalid" | "disabled";

export interface NetworkProfile {
  config: NetworkConfig;
  health: NetworkHealth | null;
  status: NetworkStatus;
  validationError?: string;
}

export function validateCustomNetwork(config: NetworkConfig): string | null {
  if (!config.name?.trim()) return "Network name is required";
  if (!config.rpcUrl?.trim()) return "RPC URL is required";
  if (!config.networkPassphrase?.trim()) return "Network passphrase is required";

  try {
    new URL(config.rpcUrl);
  } catch {
    return "RPC URL must be a valid URL";
  }

  if (config.horizonUrl) {
    try {
      new URL(config.horizonUrl);
    } catch {
      return "Horizon URL must be a valid URL";
    }
  }

  return null;
}

export function buildNetworkProfile(
  config: NetworkConfig,
  health: NetworkHealth | null,
): NetworkProfile {
  const validationError = config.isCustom ? validateCustomNetwork(config) ?? undefined : undefined;
  const status: NetworkStatus =
    validationError ? "invalid" : health?.status === "offline" ? "disabled" : "valid";

  return { config, health, status, validationError };
}

export function isNetworkRepairNeeded(profile: NetworkProfile): boolean {
  return profile.status === "invalid" || profile.status === "disabled";
}
