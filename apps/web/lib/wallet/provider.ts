import * as freighter from "@stellar/freighter-api";
import albedo from "@albedo-link/intent";

export type WalletProviderId = "freighter" | "albedo";

// FE-041: Capability matrix — explicit flags per provider
export interface WalletCapabilities {
  canSign: boolean;
  canSignAuthEntries: boolean;
  requiresExtension: boolean;
  supportsTestnet: boolean;
  supportsMainnet: boolean;
}

export interface WalletSession {
  provider: WalletProviderId;
  address: string;
}

// W7-FE-001: Best-effort snapshot of the wallet-selected network so the app
// can compare it against the active Soroban network and warn on mismatch.
// Providers that cannot report their selected network (e.g. Albedo) return
// null — callers should treat null as "unknown" and skip the warning.
export interface WalletNetworkSnapshot {
  networkPassphrase: string;
  networkName?: string;
}

export interface WalletProviderDefinition {
  id: WalletProviderId;
  label: string;
  description: string;
  accentClassName: string;
  capabilities: WalletCapabilities;
  connect: () => Promise<WalletSession>;
  // FE-041: Signing abstraction — unified sign interface
  signTransaction: (xdr: string, networkPassphrase: string) => Promise<string>;
  // FE-042: Revalidation — check if the provider is still live
  revalidate: () => Promise<boolean>;
  // W7-FE-001: Best-effort fetch of the wallet's active network
  getNetworkSnapshot: () => Promise<WalletNetworkSnapshot | null>;
}

async function connectFreighter(): Promise<WalletSession> {
  if (freighter.isConnected) {
    const installed = await freighter.isConnected();
    if (!installed) {
      throw new Error(
        "Freighter is not installed. Please install the browser extension.",
      );
    }
  }

  if (freighter.isAllowed) {
    const allowedRes = await freighter.isAllowed();
    const hasAccess =
      typeof allowedRes === "object"
        ? Boolean((allowedRes as { isAllowed?: boolean }).isAllowed)
        : Boolean(allowedRes);

    if (!hasAccess && freighter.setAllowed) {
      await freighter.setAllowed();
    }
  }

  let finalAddress = "";

  if (freighter.getAddress) {
    const addrRes = await freighter.getAddress();
    finalAddress =
      typeof addrRes === "object"
        ? ((addrRes as { address?: string }).address ?? "")
        : addrRes;
  }

  if (!finalAddress && "getPublicKey" in freighter) {
    const publicKeyGetter = (
      freighter as typeof freighter & {
        getPublicKey?: () => Promise<string | { publicKey?: string }>;
      }
    ).getPublicKey;

    if (publicKeyGetter) {
      const pubKeyRes = await publicKeyGetter();
      finalAddress =
        typeof pubKeyRes === "object"
          ? ((pubKeyRes as { publicKey?: string }).publicKey ?? "")
          : pubKeyRes;
    }
  }

  if (!finalAddress) {
    throw new Error(
      "Could not retrieve address. Make sure your Freighter wallet is unlocked.",
    );
  }

  return { provider: "freighter", address: finalAddress };
}

async function connectAlbedo(): Promise<WalletSession> {
  const result = await albedo.publicKey({});
  return { provider: "albedo", address: result.pubkey };
}

// FE-041: Signing abstraction implementations
async function freighterSign(
  xdr: string,
  networkPassphrase: string,
): Promise<string> {
  const { signTransaction } = await import("@stellar/freighter-api");
  const res = await signTransaction(xdr, { networkPassphrase });
  if (typeof res === "object" && "signedTxXdr" in res) {
    return (res as { signedTxXdr: string }).signedTxXdr;
  }
  return res as unknown as string;
}

async function albedoSign(
  xdr: string,
  networkPassphrase: string,
): Promise<string> {
  const result = await albedo.tx({ xdr, network: networkPassphrase });
  return result.signed_envelope_xdr;
}

// FE-042: Revalidation helpers
async function freighterRevalidate(): Promise<boolean> {
  try {
    if (!freighter.isConnected) return false;
    const connected = await freighter.isConnected();
    const isConn =
      typeof connected === "object"
        ? Boolean((connected as { isConnected?: boolean }).isConnected)
        : Boolean(connected);
    if (!isConn) return false;

    if (freighter.getAddress) {
      const addrRes = await freighter.getAddress();
      const addr =
        typeof addrRes === "object"
          ? ((addrRes as { address?: string }).address ?? "")
          : addrRes;
      return Boolean(addr);
    }
    return true;
  } catch {
    return false;
  }
}

async function albedoRevalidate(): Promise<boolean> {
  // W7-FE-002: Albedo's intent API is web-based, but a previous session can
  // have expired or been revoked by the user. Re-probe publicKey to confirm
  // the intent endpoint still answers for this origin.
  try {
    await albedo.publicKey({});
    return true;
  } catch {
    return false;
  }
}

// W7-FE-001: Network snapshot — best-effort fetch of the wallet-selected
// network so the app can warn on a wallet-vs-app mismatch.
async function freighterGetNetworkSnapshot(): Promise<WalletNetworkSnapshot | null> {
  try {
    if (!freighter.getNetworkDetails) return null;
    const details = (await freighter.getNetworkDetails()) as
      | {
          network?: string;
          networkPassphrase?: string;
          error?: unknown;
        }
      | null
      | undefined;
    if (!details || details.error || !details.networkPassphrase) {
      return null;
    }
    return {
      networkPassphrase: details.networkPassphrase,
      networkName: details.network,
    };
  } catch {
    return null;
  }
}

async function albedoGetNetworkSnapshot(): Promise<WalletNetworkSnapshot | null> {
  // Albedo's intent API does not expose the user's currently selected
  // network on a per-session basis. We intentionally return null so the
  // mismatch banner shows a "wallet network unknown" state rather than a
  // false positive when an Albedo session is active.
  return null;
}

export const walletProviders: Record<
  WalletProviderId,
  WalletProviderDefinition
> = {
  freighter: {
    id: "freighter",
    label: "Freighter",
    description: "Stellar's primary extension wallet",
    accentClassName: "text-purple-600",
    capabilities: {
      canSign: true,
      canSignAuthEntries: true,
      requiresExtension: true,
      supportsTestnet: true,
      supportsMainnet: true,
    },
    connect: connectFreighter,
    signTransaction: freighterSign,
    revalidate: freighterRevalidate,
    getNetworkSnapshot: freighterGetNetworkSnapshot,
  },
  albedo: {
    id: "albedo",
    label: "Albedo",
    description: "Web-based wallet, no extension required",
    accentClassName: "text-orange-600",
    capabilities: {
      canSign: true,
      canSignAuthEntries: false,
      requiresExtension: false,
      supportsTestnet: true,
      supportsMainnet: true,
    },
    connect: connectAlbedo,
    signTransaction: albedoSign,
    revalidate: albedoRevalidate,
    getNetworkSnapshot: albedoGetNetworkSnapshot,
  },
};

export const walletProviderList = Object.values(walletProviders);

// FE-041: Capability guard — throws early with clear message if unsupported
export function assertCapability(
  providerId: WalletProviderId,
  capability: keyof WalletCapabilities,
): void {
  const caps = walletProviders[providerId].capabilities;
  if (!caps[capability]) {
    throw new Error(
      `Wallet "${walletProviders[providerId].label}" does not support: ${capability}`,
    );
  }
}
