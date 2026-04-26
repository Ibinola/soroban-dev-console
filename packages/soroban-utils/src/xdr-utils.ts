import { nativeToScVal, StrKey, xdr } from "@stellar/stellar-sdk";

export type XdrType = "TransactionEnvelope" | "ScVal" | "LedgerKey";

export function encodeJsonToXdr(jsonString: string, type: XdrType): string {
  try {
    const obj = JSON.parse(jsonString);

    switch (type) {
      case "TransactionEnvelope":
        if (typeof obj === "string") {
          return xdr.TransactionEnvelope.fromXDR(obj, "base64").toXDR("base64");
        }
        if (typeof obj?.xdr === "string") {
          return xdr.TransactionEnvelope.fromXDR(obj.xdr, "base64").toXDR("base64");
        }
        throw new Error(
          "TransactionEnvelope encoding currently accepts base64 XDR only.",
        );

      case "ScVal":
        return nativeToScVal(obj).toXDR("base64");

      case "LedgerKey":
        if (typeof obj === "string") {
          return xdr.LedgerKey.fromXDR(obj, "base64").toXDR("base64");
        }
        if (typeof obj?.xdr === "string") {
          return xdr.LedgerKey.fromXDR(obj.xdr, "base64").toXDR("base64");
        }
        throw new Error("LedgerKey encoding currently accepts base64 XDR only.");

      default:
        throw new Error("Unsupported XDR type for encoding");
    }
  } catch (error: any) {
    throw new Error(`Encoding failed: ${error.message}`);
  }
}

/**
 * FE-049: Extract the real contract ID from a successful deploy transaction's
 * result XDR. The Soroban host returns the new contract address as an ScAddress
 * inside the transaction's return value.
 *
 * @param resultMetaXdr - TransactionMeta from getTransaction, or its base64 XDR
 * @returns Strkey-encoded contract ID (C…) or null if not found
 */
export function extractContractIdFromDeployResult(
  resultMetaXdr: string | xdr.TransactionMeta,
): string | null {
  try {
    const meta =
      typeof resultMetaXdr === "string"
        ? xdr.TransactionMeta.fromXDR(resultMetaXdr, "base64")
        : resultMetaXdr;
    // v3 meta carries sorobanMeta with the return value
    const sorobanMeta = meta.v3().sorobanMeta();
    if (!sorobanMeta) return null;

    const returnValue = sorobanMeta.returnValue();
    // The return value of createCustomContract is ScVal::Address
    if (returnValue.switch().name !== "scvAddress") return null;

    const scAddress = returnValue.address();
    if (scAddress.switch().name !== "scAddressTypeContract") return null;

    const contractIdBytes = scAddress.contractId();
    return StrKey.encodeContract(
      Buffer.from(contractIdBytes as unknown as Uint8Array),
    );
  } catch {
    return null;
  }
}
