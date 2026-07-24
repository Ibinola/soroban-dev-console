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

// FE-042 / W7-FE-002: Session now carries the network passphrase so the
// wallet store can detect a mismatch if the user changes networks later.
export interface WalletSession {
  provider: WalletProviderId;
  address: string;
  networkPassphrase?: string | null;
}

// W7-FE-002 / #675: revalidation returns the wallet's *current* network
// passphrase so the store can compare it against the active app network.
export interface RevalidationResult {
  isValid: boolean;
  networkPassphrase?: string | null;
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
  // FE-042: Revalidation — check if the provider is still live.
  // Returns the wallet's current networkPassphrase so the store can
  // surface a mismatch warning to the user.
  revalidate: () => Promise<RevalidationResult>;
  // W7-FE-002 / #675: best-effort lookup of the wallet's active network
  // passphrase without re-prompting the user.
  getNetworkPassphrase?: () => Promise<string | null>;
}

/**
 * Best-effort fetch of the wallet provider's active network passphrase.
 * Used for the network mismatch warning (#675). Returns null if the
 * provider does not expose network info or if the user denies/interrupts.
 */
async function freighterGetNetworkPassphrase(): Promise<string | null> {
  try {
    // Preferred path — getNetworkDetails returns the full passphrase.
    if (freighter.getNetworkDetails) {
      const details = await freighter.getNetworkDetails();
      if (!details?.error && details?.networkPassphrase) {
        return details.networkPassphrase;
      }
    }
    // Fallback — older getNetwork API.
    if (freighter.getNetwork) {
      const network = await freighter.getNetwork();
      if (!network?.error && network?.networkPassphrase) {
        return network.networkPassphrase;
      }
    }
  } catch {
    // Swallow — we treat any failure as "could not determine wallet network".
  }
  return null;
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
    const publicKeyGetter = (freighter as typeof freighter & {
      getPublicKey?: () => Promise<string | { publicKey?: string }>;
    }).getPublicKey;

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

  const networkPassphrase = await freighterGetNetworkPassphrase();
  return { provider: "freighter", address: finalAddress, networkPassphrase };
}

async function connectAlbedo(): Promise<WalletSession> {
  const result = await albedo.publicKey({});
  // Albedo's public_key response does not include a network field by
  // default; we treat it as unknown and let revalidation resolve it.
  return {
    provider: "albedo",
    address: result.pubkey,
    networkPassphrase: null,
  };
}

// FE-041: Signing abstraction implementations
async function freighterSign(xdr: string, networkPassphrase: string): Promise<string> {
  const { signTransaction } = await import("@stellar/freighter-api");
  const res = await signTransaction(xdr, { networkPassphrase });
  if (typeof res === "object" && "signedTxXdr" in res) {
    return (res as { signedTxXdr: string }).signedTxXdr;
  }
  return res as unknown as string;
}

async function albedoSign(xdr: string, networkPassphrase: string): Promise<string> {
  const result = await albedo.tx({ xdr, network: networkPassphrase });
  return result.signed_envelope_xdr;
}

// FE-042: Revalidation helpers
async function freighterRevalidate(): Promise<RevalidationResult> {
  try {
    if (!freighter.isConnected) return { isValid: false };
    const connected = await freighter.isConnected();
    const isConn =
      typeof connected === "object"
        ? Boolean((connected as { isConnected?: boolean }).isConnected)
        : Boolean(connected);
    if (!isConn) return { isValid: false };

    if (freighter.getAddress) {
      const addrRes = await freighter.getAddress();
      const addr =
        typeof addrRes === "object"
          ? ((addrRes as { address?: string }).address ?? "")
          : addrRes;
      if (!addr) return { isValid: false };
    }

    const passphrase = await freighterGetNetworkPassphrase();
    return { isValid: true, networkPassphrase: passphrase };
  } catch {
    return { isValid: false };
  }
}

// W7-FE-002 / #651: albedoRevalidate now attempts a session probe via
// publicKey({}). A rejection (user revoked access or session expired)
// yields `isValid: false` so the wallet store clears itself.
async function albedoRevalidate(): Promise<RevalidationResult> {
  try {
    const result = await albedo.publicKey({});
    return {
      isValid: Boolean(result?.pubkey),
      networkPassphrase: null,
    };
  } catch {
    return { isValid: false };
  }
}

export const walletProviders: Record<WalletProviderId, WalletProviderDefinition> = {
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
    getNetworkPassphrase: freighterGetNetworkPassphrase,
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
