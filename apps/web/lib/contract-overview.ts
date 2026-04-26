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
