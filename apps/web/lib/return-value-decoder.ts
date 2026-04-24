export type ScValType =
  | "bool"
  | "u32"
  | "i32"
  | "u64"
  | "i64"
  | "u128"
  | "i128"
  | "symbol"
  | "string"
  | "address"
  | "map"
  | "vec"
  | "unknown";

export interface DecodedValue {
  type: ScValType;
  value: unknown;
  raw?: string;
}

export function decodeReturnValue(
  xdrBase64: string,
  expectedType?: ScValType,
): DecodedValue {
  if (!xdrBase64) {
    return { type: "unknown", value: null, raw: xdrBase64 };
  }

  try {
    const decoded = Buffer.from(xdrBase64, "base64").toString("utf-8");

    if (expectedType === "bool") {
      return {
        type: "bool",
        value: decoded === "true" || decoded === "1",
        raw: xdrBase64,
      };
    }

    if (expectedType === "u32" || expectedType === "i32") {
      const num = parseInt(decoded, 10);
      return {
        type: expectedType,
        value: isNaN(num) ? 0 : num,
        raw: xdrBase64,
      };
    }

    if (expectedType === "string" || expectedType === "symbol") {
      return { type: expectedType, value: decoded, raw: xdrBase64 };
    }

    return { type: "unknown", value: decoded, raw: xdrBase64 };
  } catch {
    return { type: "unknown", value: null, raw: xdrBase64 };
  }
}

export function formatDecodedValue(decoded: DecodedValue): string {
  if (decoded.value === null || decoded.value === undefined) return "(empty)";
  if (typeof decoded.value === "object") return JSON.stringify(decoded.value);
  return String(decoded.value);
}
