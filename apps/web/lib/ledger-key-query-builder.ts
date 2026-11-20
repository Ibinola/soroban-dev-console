import { Address, xdr } from "@stellar/stellar-sdk";

/**
 * Build a base64 LedgerKey::ContractData XDR string for getLedgerEntries
 * RPC lookups. (#926)
 */
export type StorageDurability = "instance" | "persistent" | "temporary";

export function buildContractDataLedgerKey(
  contractId: string,
  keyScVal: xdr.ScVal,
  durability: StorageDurability,
): string {
  const durabilityXdr =
    durability === "temporary"
      ? xdr.ContractDataDurability.temporary()
      : xdr.ContractDataDurability.persistent();

  const contractData = new xdr.LedgerKeyContractData({
    contract: new Address(contractId).toScAddress(),
    key: keyScVal,
    durability: durabilityXdr,
  });

  const ledgerKey = xdr.LedgerKey.contractData(contractData);
  return ledgerKey.toXDR("base64");
}

export function isValidContractId(contractId: string): boolean {
  try {
    new Address(contractId);
    return contractId.startsWith("C");
  } catch {
    return false;
  }
}

export function buildCopyableLedgerKeyLabel(contractId: string, durability: StorageDurability): string {
  return `LedgerKey::ContractData(${contractId.slice(0, 8)}..., ${durability})`;
}
