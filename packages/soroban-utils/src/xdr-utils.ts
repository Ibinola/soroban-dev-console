import { nativeToScVal, StrKey, xdr } from "@stellar/stellar-sdk";

export type XdrType = "TransactionEnvelope" | "ScVal" | "LedgerKey";

/**
 * Decoded XDR result. Returned by {@link decodeXdr}.
 *
 * `typeName` is the inferred Stellar XDR type name (best-effort heuristic).
 * `json` is a JSON-stringified representation safe to render in the UI.
 */
export interface DecodedXdr {
  typeName: string;
  parsed: unknown;
  json: string;
  raw: string;
  error?: string;
}

/**
 * BigInt-safe JSON replacer used across the app.
 * Public so consumers (e.g. <XdrTooltip />) can re-use the same shape.
 */
export const xdrJsonReplacer = (_key: string, value: unknown): unknown => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};

/**
 * Best-effort XDR decoder used by FE-680 / W7-FE-002.
 *
 * Tries the most common Stellar/Soroban XDR envelope types in order of
 * likelihood and returns the first that decodes successfully. Returns
 * `null` if no known type matches.
 *
 * The returned `json` field is BigInt-safe and safe to render in <pre>.
 */
export function decodeXdr(base64Xdr: string): DecodedXdr | null {
  if (!base64Xdr || typeof base64Xdr !== "string") return null;

  const attempts: Array<{ name: string; from: (raw: string, fmt: "base64") => unknown }> = [
    { name: "Transaction Envelope", from: xdr.TransactionEnvelope.fromXDR },
    { name: "Transaction Result",   from: xdr.TransactionResult.fromXDR },
    { name: "Transaction Meta",     from: xdr.TransactionMeta.fromXDR },
    { name: "Soroban Value (ScVal)", from: xdr.ScVal.fromXDR },
    { name: "Ledger Entry",         from: xdr.LedgerEntry.fromXDR },
    { name: "Soroban Auth",         from: xdr.SorobanAuthorizationEntry.fromXDR },
  ];

  for (const attempt of attempts) {
    try {
      const parsed = attempt.from(base64Xdr, "base64");
      return {
        typeName: attempt.name,
        parsed,
        json: JSON.stringify(parsed, xdrJsonReplacer, 2),
        raw: base64Xdr,
      };
    } catch {
      // try next type
    }
  }

  return null;
}

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
