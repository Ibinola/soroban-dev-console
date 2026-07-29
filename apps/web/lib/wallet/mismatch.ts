/**
 * W7-FE-002 / #675: Pure-logic helpers for detecting wallet-vs-app network
 * mismatch. Kept side-effect free so they can be unit tested without
 * wiring up React, Zustand, or any wallet SDK.
 */

import { DEFAULT_NETWORKS, type NetworkConfig } from "@/store/useNetworkStore";

/**
 * Resolve the active app network configuration by id. Falls back to the
 * testnet config when an unknown id is supplied.
 */
export function resolveNetworkConfig(networkId: string | null | undefined): NetworkConfig {
  if (!networkId) return DEFAULT_NETWORKS.testnet;
  return (
    DEFAULT_NETWORKS[networkId] ??
    DEFAULT_NETWORKS.testnet
  );
}

/**
 * Determine whether a previously-recorded wallet session now points at a
 * different network than the app's currently-selected network.
 *
 * Detection priority:
 *   1. Network passphrase comparison — strongest signal (works across
 *      custom networks and renamed IDs).
 *   2. Network ID comparison — fallback for legacy persisted sessions
 *      that don't carry a passphrase.
 *   3. If nothing was recorded (legacy session) we cannot detect a
 *      mismatch — return `false`.
 */
export function isWalletNetworkMismatch(params: {
  recordedNetworkId: string | null | undefined;
  recordedNetworkPassphrase: string | null | undefined;
  currentNetworkId: string | null | undefined;
  currentNetworkPassphrase?: string | null;
}): boolean {
  const {
    recordedNetworkId,
    recordedNetworkPassphrase,
    currentNetworkId,
    currentNetworkPassphrase,
  } = params;

  if (!recordedNetworkId) return false;

  // Strongest signal — compare passphrases when both sides are known.
  if (
    typeof recordedNetworkPassphrase === "string" &&
    recordedNetworkPassphrase.length > 0 &&
    typeof currentNetworkPassphrase === "string" &&
    currentNetworkPassphrase.length > 0
  ) {
    return recordedNetworkPassphrase !== currentNetworkPassphrase;
  }

  // Fallback — compare IDs only.
  return currentNetworkId !== recordedNetworkId;
}

/**
 * Produce a human-readable label for a network passphrase by reverse
 * matching it against the DEFAULT_NETWORKS map plus the provided custom
 * networks. Returns "Unknown network" when no match is found.
 */
export function passphraseToNetworkName(
  passphrase: string | null | undefined,
  customNetworks: ReadonlyArray<NetworkConfig> = [],
): string {
  if (!passphrase) return "Unknown network";
  const match = Object.values(DEFAULT_NETWORKS).find(
    (n) => n.networkPassphrase === passphrase,
  );
  if (match) return match.name;
  const custom = customNetworks.find((n) => n.networkPassphrase === passphrase);
  if (custom) return custom.name;
  return "Unknown network";
}
