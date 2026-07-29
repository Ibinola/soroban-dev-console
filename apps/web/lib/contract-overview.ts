import { rpc as SorobanRpc, Address, xdr, StrKey } from "@stellar/stellar-sdk";

export interface ContractOverview {
  contractId: string;
  network: string;
  rpcUrl: string;
  exists: boolean;
  lastModifiedLedger?: number;
  wasmHash?: string;
  hasInterface: boolean;
  error?: string;
}

export async function fetchContractOverview(
  contractId: string,
  networkName: string,
  rpcUrl: string
): Promise<ContractOverview> {
  const base: ContractOverview = {
    contractId,
    network: networkName,
    rpcUrl,
    exists: false,
    hasInterface: false,
  };

  if (!StrKey.isValidContract(contractId)) {
    return {
      ...base,
      error:
        "Invalid Contract ID format. Must be a 56-character string starting with C.",
    };
  }

  try {
    const server = new SorobanRpc.Server(rpcUrl);

    const instanceKey = xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: new Address(contractId).toScAddress(),
        key: xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: xdr.ContractDataDurability.persistent(),
      })
    );

    const response = await server.getLedgerEntries(instanceKey);

    if (!response.entries?.length) {
      return { ...base, exists: false };
    }

    const entry = response.entries[0];
    const lastModifiedLedger = entry.lastModifiedLedgerSeq;

    let wasmHash: string | undefined;
    let hasInterface = false;

    try {
      const executable = entry.val
        .contractData()
        .val()
        .instance()
        .executable();
      const hash = executable.wasmHash?.();
      if (hash) {
        wasmHash = Buffer.from(hash).toString("hex");
        hasInterface = true;
      }
    } catch {
      // Partial failure — contract exists but interface metadata unavailable
    }

    return { ...base, exists: true, lastModifiedLedger, wasmHash, hasInterface };
  } catch (err: any) {
    // Partial failure: return what we know, surface the error non-fatally
    return { ...base, error: err?.message ?? "Failed to fetch contract data" };
  }
}

/**
 * Human-readable "time since deployment" from a unix timestamp (ms).
 * Returns a compact relative label such as "3d ago" or "just now".
 */
export function formatRelativeTime(timestampMs: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - timestampMs) / 1000));
  if (seconds < 45) return "just now";

  const units: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [4.34524, "w"],
    [12, "mo"],
    [Number.POSITIVE_INFINITY, "y"],
  ];

  let value = seconds;
  let label = "s";
  for (const [factor, unit] of units) {
    label = unit;
    if (value < factor) break;
    value = Math.floor(value / factor);
  }
  return `${value}${label} ago`;
}

/** Short display label for the network a contract lives on. */
export function getNetworkBadgeLabel(network: string): string {
  const normalized = network.trim().toLowerCase();
  const known: Record<string, string> = {
    public: "Mainnet",
    mainnet: "Mainnet",
    testnet: "Testnet",
    futurenet: "Futurenet",
    standalone: "Local",
    local: "Local",
  };
  if (known[normalized]) return known[normalized];
  return network.charAt(0).toUpperCase() + network.slice(1);
}
