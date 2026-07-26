import { Address, StrKey, xdr } from "@stellar/stellar-sdk";

export type LedgerKeyType = "ContractData" | "ContractCode" | "Account";

export interface ContractDataKeyInput {
  type: "ContractData";
  contractId: string;
  storageKeyType: "symbol" | "string" | "address" | "i32";
  storageKeyValue: string;
  durability: "persistent" | "temporary";
}

export interface ContractCodeKeyInput {
  type: "ContractCode";
  wasmHash: string;
}

export interface AccountKeyInput {
  type: "Account";
  accountId: string;
}

export type LedgerKeyInput = ContractDataKeyInput | ContractCodeKeyInput | AccountKeyInput;

function toScAddress(value: string): xdr.ScAddress {
  return new Address(value).toScAddress();
}

function toStorageScVal(type: string, value: string): xdr.ScVal {
  switch (type) {
    case "symbol":
      return xdr.ScVal.scvSymbol(value);
    case "string":
      return xdr.ScVal.scvString(value);
    case "i32": {
      const parsed = Number(value);
      if (!Number.isInteger(parsed)) {
        throw new Error("Value must be a valid i32 integer");
      }
      return xdr.ScVal.scvI32(parsed);
    }
    case "address":
      return xdr.ScVal.scvAddress(toScAddress(value));
    default:
      throw new Error(`Unsupported storage key type: ${type}`);
  }
}

export function buildLedgerKeyXdr(input: LedgerKeyInput): string {
  let ledgerKey: xdr.LedgerKey;

  switch (input.type) {
    case "ContractData": {
      const contractId = input.contractId.trim();
      if (!contractId) throw new Error("Contract ID is required");
      if (!StrKey.isValidContract(contractId)) throw new Error("Invalid Contract ID format");

      const keyValue = input.storageKeyValue.trim();
      if (!keyValue) throw new Error("Storage key value is required");

      const durability = input.durability === "temporary"
        ? xdr.ContractDataDurability.temporary()
        : xdr.ContractDataDurability.persistent();

      ledgerKey = xdr.LedgerKey.contractData(
        new xdr.LedgerKeyContractData({
          contract: toScAddress(contractId),
          key: toStorageScVal(input.storageKeyType, keyValue),
          durability,
        }),
      );
      break;
    }

    case "ContractCode": {
      const wasmHash = input.wasmHash.trim();
      if (!wasmHash) throw new Error("WASM hash is required");
      if (wasmHash.length !== 64) throw new Error("WASM hash must be 64 hex characters");

      ledgerKey = xdr.LedgerKey.contractCode(
        new xdr.LedgerKeyContractCode({
          hash: Buffer.from(wasmHash, "hex"),
        }),
      );
      break;
    }

    case "Account": {
      const accountId = input.accountId.trim();
      if (!accountId) throw new Error("Account ID is required");
      if (!StrKey.isValidEd25519PublicKey(accountId)) throw new Error("Invalid Account ID format");

      const scAddr = new Address(accountId).toScAddress();
      ledgerKey = xdr.LedgerKey.account(
        new xdr.LedgerKeyAccount({
          accountId: scAddr.accountId(),
        }),
      );
      break;
    }

    default:
      throw new Error(`Unknown ledger key type: ${(input as any).type}`);
  }

  return ledgerKey.toXDR("base64");
}

export function decodeLedgerKeyXdr(xdrBase64: string): string {
  const ledgerKey = xdr.LedgerKey.fromXDR(xdrBase64, "base64");
  return ledgerKey.switch().name;
}

export interface LedgerEntryResponse {
  lastModifiedLedgerSeq?: string;
  liveUntilLedgerSeq?: string;
  value?: string;
  key?: string;
}

export interface LedgerQueryResult {
  entries: LedgerEntryResponse[];
  found: boolean;
}

export async function fetchLedgerEntry(
  network: string,
  keyXdr: string,
): Promise<LedgerQueryResult> {
  const { sorobanRpc } = await import("@/lib/api/rpc-gateway");
  const response = await sorobanRpc.getLedgerEntries(network, [keyXdr]) as {
    entries?: LedgerEntryResponse[];
  };

  const entries = response.entries ?? [];
  return {
    entries,
    found: entries.length > 0,
  };
}
