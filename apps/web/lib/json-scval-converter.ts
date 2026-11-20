import { nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";

/**
 * Bi-directional conversion between plain JSON values and Soroban
 * ScVal XDR base64 strings. (#923)
 */
export function jsonToScValXdr(value: unknown, type?: string): string {
  const scVal = type ? nativeToScVal(value, { type }) : nativeToScVal(value);
  return scVal.toXDR("base64");
}

export function scValXdrToJson(base64: string): unknown {
  const scVal = xdr.ScVal.fromXDR(base64, "base64");
  return scValToNative(scVal);
}

export function isConvertibleToScVal(value: unknown): boolean {
  try {
    nativeToScVal(value);
    return true;
  } catch {
    return false;
  }
}
